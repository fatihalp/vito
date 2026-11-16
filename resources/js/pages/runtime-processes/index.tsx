import { useTranslate } from '@/hooks/use-translate';
import { Head } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import RuntimeProcesses from '@/components/runtime-processes';
import ServerLayout from '@/layouts/server/layout';

export default function RuntimeProcessesIndex() {
  const translateText = useTranslate();
  return <ServerLayout><Head title={translateText("Runtime processes")} /><Container><Heading title={translateText("Runtime processes")} description={translateText("Track existing services and their application connections.")} /><RuntimeProcesses /></Container></ServerLayout>;
}
