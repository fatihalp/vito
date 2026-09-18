<?php

namespace App\Support;

use App\DTOs\StorageMigrationCopyResult;
use App\Exceptions\StorageMigrationObjectMissing;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use Closure;
use RuntimeException;
use Throwable;

class S3ObjectCopier
{
    public function __construct(
        private readonly int $multipartThreshold = 16 * 1024 * 1024,
        private readonly int $partSize = 16 * 1024 * 1024,
    ) {}

    public function head(S3Client $client, string $bucket, string $key): ?array
    {
        try {
            $result = $client->headObject([
                'Bucket' => $bucket,
                'Key' => $key,
            ]);
        } catch (S3Exception $e) {
            if ($e->getStatusCode() === 404) {
                return null;
            }

            throw $e;
        }

        return [
            'size' => (int) $result->get('ContentLength'),
            'etag' => trim((string) $result->get('ETag'), '"'),
        ];
    }

    public function listPage(S3Client $client, string $bucket, string $prefix, ?string $continuationToken, int $maxKeys = 1000): array
    {
        $result = $client->listObjectsV2(array_filter([
            'Bucket' => $bucket,
            'Prefix' => $prefix !== '' ? $prefix : null,
            'ContinuationToken' => $continuationToken,
            'MaxKeys' => $maxKeys,
        ], fn ($value) => $value !== null));

        $objects = array_map(
            fn (array $object): array => ['key' => $object['Key'], 'size' => (int) $object['Size']],
            $result->get('Contents') ?? [],
        );

        return [
            'objects' => $objects,
            'nextToken' => $result->get('IsTruncated') ? $result->get('NextContinuationToken') : null,
        ];
    }

    public function copy(
        S3Client $source,
        string $sourceBucket,
        string $sourceKey,
        S3Client $target,
        string $targetBucket,
        string $targetKey,
        ?Closure $onPart = null,
        ?int $size = null,
    ): StorageMigrationCopyResult {
        $size ??= $this->head($source, $sourceBucket, $sourceKey)['size'] ?? null;

        if ($size === null) {
            throw new StorageMigrationObjectMissing("Source object not found: {$sourceBucket}/{$sourceKey}");
        }

        try {
            return $size >= $this->multipartThreshold
                ? $this->copyLarge($source, $sourceBucket, $sourceKey, $target, $targetBucket, $targetKey, $size, $onPart)
                : $this->copySmall($source, $sourceBucket, $sourceKey, $target, $targetBucket, $targetKey);
        } catch (S3Exception $e) {
            if ($e->getStatusCode() === 404 && in_array($e->getAwsErrorCode(), ['NoSuchKey', 'NotFound'], true)) {
                throw new StorageMigrationObjectMissing("Source object not found: {$sourceBucket}/{$sourceKey}");
            }

            throw $e;
        }
    }

    private function copySmall(
        S3Client $source,
        string $sourceBucket,
        string $sourceKey,
        S3Client $target,
        string $targetBucket,
        string $targetKey,
    ): StorageMigrationCopyResult {
        $object = $source->getObject([
            'Bucket' => $sourceBucket,
            'Key' => $sourceKey,
        ]);

        $body = (string) $object['Body'];
        $hash = md5($body, true);

        $target->putObject([
            'Bucket' => $targetBucket,
            'Key' => $targetKey,
            'Body' => $body,
            'ContentMD5' => base64_encode($hash),
        ]);

        return new StorageMigrationCopyResult(bytes: strlen($body), checksum: bin2hex($hash));
    }

    private function copyLarge(
        S3Client $source,
        string $sourceBucket,
        string $sourceKey,
        S3Client $target,
        string $targetBucket,
        string $targetKey,
        int $size,
        ?Closure $onPart,
    ): StorageMigrationCopyResult {
        $uploadId = $target->createMultipartUpload([
            'Bucket' => $targetBucket,
            'Key' => $targetKey,
        ])->get('UploadId');

        try {
            $parts = [];
            $totalBytes = 0;
            $partNumber = 1;
            $offset = 0;

            while ($offset < $size) {
                $length = min($this->partSize, $size - $offset);

                $chunk = $source->getObject([
                    'Bucket' => $sourceBucket,
                    'Key' => $sourceKey,
                    'Range' => "bytes={$offset}-".($offset + $length - 1),
                ]);

                $body = (string) $chunk['Body'];
                $size = preg_match('/\/(\d+)$/', (string) $chunk['ContentRange'], $total) === 1 ? (int) $total[1] : $size;

                if ($body === '') {
                    throw new RuntimeException("The source object ended before its reported size: {$sourceBucket}/{$sourceKey}");
                }

                $uploaded = $target->uploadPart([
                    'Bucket' => $targetBucket,
                    'Key' => $targetKey,
                    'UploadId' => $uploadId,
                    'PartNumber' => $partNumber,
                    'Body' => $body,
                    'ContentMD5' => base64_encode(md5($body, true)),
                ]);

                $parts[] = [
                    'PartNumber' => $partNumber,
                    'ETag' => $uploaded->get('ETag'),
                ];

                $totalBytes += strlen($body);
                $offset += strlen($body);
                $partNumber++;

                if ($onPart !== null) {
                    $onPart();
                }
            }

            $completed = $target->completeMultipartUpload([
                'Bucket' => $targetBucket,
                'Key' => $targetKey,
                'UploadId' => $uploadId,
                'MultipartUpload' => ['Parts' => $parts],
            ]);

            return new StorageMigrationCopyResult(
                bytes: $totalBytes,
                checksum: trim((string) $completed->get('ETag'), '"'),
            );
        } catch (Throwable $e) {
            $target->abortMultipartUpload([
                'Bucket' => $targetBucket,
                'Key' => $targetKey,
                'UploadId' => $uploadId,
            ]);

            throw $e;
        }
    }
}
