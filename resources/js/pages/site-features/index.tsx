import { useTranslate } from '@/hooks/use-translate';
import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import { TriangleAlertIcon } from 'lucide-react';
import { Site, SiteFeature } from '@/types/site';
import FeaturesCard from '@/components/features-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDialog } from '@/hooks/use-dialog';

export default function SiteFeatures() {
  const translateText = useTranslate();
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
      <Head title={translateText("Features - :value", { value: page.props.site.domain })} />

      <Container>
        <HeaderContainer>
          <Heading title={translateText('Features')} description={translateText("Your site has some features enabled by Pure or other plugins")} />
        </HeaderContainer>

        <SiteBanners site={page.props.site} />

        <Alert>
          <TriangleAlertIcon className="text-warning!" />
          <AlertDescription className="flex gap-1">
            {translateText("Pure now uses the new plugins system. If the feature you're looking for is not here, check the")}
            <Link className="text-primary" href={"/admin/plugins"}>
              {translateText("plugins")}
            </Link>
            {translateText("and install the required one.")}
          </AlertDescription>
        </Alert>

        <FeaturesCard
          title={translateText("Site features")}
          features={page.props.features}
          onActionSelect={(featureId, actionId, action) => 
            dialog.siteFeatureAction.open({ site: page.props.site, featureId, actionId, action })
          }
        />
      </Container>
    </ServerLayout>
  );
}
