import { Head } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import RuntimeProcesses from '@/components/runtime-processes';
import ServerLayout from '@/layouts/server/layout';

export default function RuntimeProcessesIndex() {
  return <ServerLayout><Head title="Runtime processes" /><Container><Heading title="Runtime processes" description="Track existing services and their application connections." /><RuntimeProcesses /></Container></ServerLayout>;
}
