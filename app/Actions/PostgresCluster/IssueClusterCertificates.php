<?php

namespace App\Actions\PostgresCluster;

use App\Models\PostgresCluster;
use App\Models\Server;
use Illuminate\Support\Carbon;
use phpseclib3\Crypt\EC;
use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\File\X509;

class IssueClusterCertificates
{
    private const CA_YEARS = 10;

    private const NODE_YEARS = 2;

    private const CA_RENEW_DAYS = 365;

    private const NODE_RENEW_DAYS = 30;

    /**
     * Makes sure the cluster CA and a certificate for every node exist and are not close to expiry.
     *
     * @return list<int> ids of servers whose certificate files changed
     */
    public function ensure(PostgresCluster $cluster): array
    {
        $tls = $cluster->tls ?? [];
        $renewCa = ! isset($tls['ca_cert']) || Carbon::parse($tls['ca_expires_at'])->lte(now()->addDays(self::CA_RENEW_DAYS));

        if ($renewCa) {
            $tls = [...$tls, ...$this->ca($cluster), 'previous_ca_cert' => $tls['ca_cert'] ?? null, 'nodes' => []];
        }

        $changed = [];

        foreach ($cluster->nodes() as $server) {
            $node = $tls['nodes'][$server->id] ?? null;

            if ($node === null || Carbon::parse($node['expires_at'])->lte(now()->addDays(self::NODE_RENEW_DAYS))) {
                $tls['nodes'][$server->id] = $this->node($tls, $server);
                $changed[] = $server->id;
            }
        }

        if ($changed !== [] || $renewCa) {
            $cluster->tls = $tls;
            $cluster->save();
        }

        return $renewCa ? $cluster->nodes()->pluck('id')->all() : $changed;
    }

    /**
     * @return array{ca: string, cert: string, key: string}
     */
    public function files(PostgresCluster $cluster, Server $server): array
    {
        $tls = $cluster->tls;

        return [
            'ca' => trim($tls['ca_cert']."\n".($tls['previous_ca_cert'] ?? ''))."\n",
            'cert' => $tls['nodes'][$server->id]['cert'],
            'key' => $tls['nodes'][$server->id]['key'],
        ];
    }

    public function commonName(Server $server): string
    {
        return PostgresCluster::hostAlias($server);
    }

    /**
     * @return array{ca_cert: string, ca_key: string, ca_expires_at: string}
     */
    private function ca(PostgresCluster $cluster): array
    {
        $key = EC::createKey('nistp256');
        $expires = now()->addYears(self::CA_YEARS);

        $subject = new X509;
        $subject->setPublicKey($key->getPublicKey());
        $subject->setDNProp('id-at-commonName', 'vito-pg-ca-'.$cluster->id);

        $issuer = new X509;
        $issuer->setPrivateKey($key);
        $issuer->setDN($subject->getDN());

        $x509 = new X509;
        $x509->makeCA();
        $x509->setStartDate(now()->subDay()->toDateTimeString());
        $x509->setEndDate($expires->toDateTimeString());
        $x509->setSerialNumber(bin2hex(random_bytes(16)), 16);

        return [
            'ca_cert' => $x509->saveX509($x509->sign($issuer, $subject)),
            'ca_key' => $key->toString('PKCS8'),
            'ca_expires_at' => $expires->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $tls
     * @return array{cert: string, key: string, expires_at: string}
     */
    private function node(array $tls, Server $server): array
    {
        $key = EC::createKey('nistp256');
        $expires = now()->addYears(self::NODE_YEARS);
        $name = $this->commonName($server);

        $subject = new X509;
        $subject->setPublicKey($key->getPublicKey());
        $subject->setDNProp('id-at-commonName', $name);
        $subject->setDomain($name);

        $ca = new X509;
        $ca->loadX509($tls['ca_cert']);

        $issuer = new X509;
        $issuer->setPrivateKey(PublicKeyLoader::load($tls['ca_key']));
        $issuer->setDN($ca->getDN());

        $x509 = new X509;
        $x509->setStartDate(now()->subDay()->toDateTimeString());
        $x509->setEndDate($expires->toDateTimeString());
        $x509->setSerialNumber(bin2hex(random_bytes(16)), 16);
        $x509->setExtensionValue('id-ce-keyUsage', ['digitalSignature', 'keyAgreement']);
        $x509->setExtensionValue('id-ce-extKeyUsage', ['id-kp-serverAuth', 'id-kp-clientAuth']);

        return [
            'cert' => $x509->saveX509($x509->sign($issuer, $subject)),
            'key' => $key->toString('PKCS8'),
            'expires_at' => $expires->toIso8601String(),
        ];
    }
}
