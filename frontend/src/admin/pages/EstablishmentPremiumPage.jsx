import PremiumMarketplacePage from '../../components/PremiumMarketplacePage';
import { adminApi } from '../api/adminClient';

export default function EstablishmentPremiumPage() {
  return <PremiumMarketplacePage apiClient={adminApi} title="Plano Premium do estabelecimento" />;
}
