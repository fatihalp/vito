import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { Site, SiteFeature } from '@/types/site';
import FeaturesCard from '@/components/features-card';
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

      <Container>
        <HeaderContainer>
          <Heading title="Features" description="Manage the built-in features available for your site" />
        </HeaderContainer>

        <SiteBanners site={page.props.site} />

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
