import Layout from '@/layouts/app/layout';
import { Head } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import UsersList from '@/pages/users/components/list';
import { Button } from '@/components/ui/button';
import UserForm from '@/pages/users/components/user-form';
import RolePermissionsTable from '@/pages/users/components/role-permissions-table';

export default function Users() {
  return (
    <Layout>
      <Head title="Users" />

      <Container className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between">
          <Heading title="Users" />
          <UserForm>
            <Button>Create user</Button>
          </UserForm>
        </div>
        <UsersList />
        <RolePermissionsTable />
      </Container>
    </Layout>
  );
}
