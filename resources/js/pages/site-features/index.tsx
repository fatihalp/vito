import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { TriangleAlertIcon } from 'lucide-react';
import { Site, SiteFeature } from '@/types/site';
import FeaturesCard from '@/components/features-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDialog } from '@/hooks/use-dialog';

export default function SiteFeatures() {
  const page = usePage<{
    server: Server;
    site: Site;
    features: {
      [key: string]: SiteFeature;
    };
  }>();
  const dialog = useDialog();

  return (
    <ServerLayout>
      <Head title={`Features - ${page.props.site.domain}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Features" description="Your site has some features enabled by Vito or other plugins" />
        </HeaderContainer>

        <SiteBanners site={page.props.site} />

        <Alert>
          <TriangleAlertIcon className="text-warning!" />
          <AlertDescription className="flex gap-1">
            Vito now uses the new plugins system. If the feature you're looking for is not here, check the
            <Link className="text-primary" href={route('plugins')}>
              plugins
            </Link>
            and install the required one.
          </AlertDescription>
        </Alert>

        <FeaturesCard
          title="Site features"
          features={page.props.features}
          onActionSelect={(featureId, actionId, action) => 
            dialog.siteFeatureAction.open({ site: page.props.site, featureId, actionId, action })
          }
        />
      </Container>
    </ServerLayout>
  );
}
