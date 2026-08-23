import { Head, Link, usePage } from '@inertiajs/react';
import { Server, ServerFeature } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import FeaturesCard from '@/components/features-card';
import { useDialog } from '@/hooks/use-dialog';

export default function ServerFeatures() {
  const page = usePage<{
    server: Server;
    features: {
      [key: string]: ServerFeature;
    };
  }>();
  const dialog = useDialog();

  return (
    <ServerLayout>
      <Head title={`Features - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Features" description="Your server has some features enabled by Vito or other plugins" />
        </HeaderContainer>

        <FeaturesCard
          title="Server features"
          features={page.props.features}
          onActionSelect={(featureId, actionId, action) => 
            dialog.serverFeatureAction.open({ server: page.props.server, featureId, actionId, action })
          }
        />
      </Container>
    </ServerLayout>
  );
}
