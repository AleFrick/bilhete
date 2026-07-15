import PremiumMarketplacePage from '../components/PremiumMarketplacePage';
import { api } from '../api/client';

export default function PremiumPage() {
  return <PremiumMarketplacePage apiClient={api} />;
}
