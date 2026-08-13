import { purchaseApi } from '../../api';
import GstReturnReportPage from './GstReturnReportPage';

export default function Gstr2ReportPage() {
  return (
    <GstReturnReportPage
      title="GSTR-2 (Inward Supplies)"
      partyLabel="Supplier"
      fetchReport={purchaseApi.getGstr2Report}
      fileBase="GSTR2_Report"
    />
  );
}
