import { saleApi } from '../../api';
import GstReturnReportPage from './GstReturnReportPage';

export default function Gstr1ReportPage() {
  return (
    <GstReturnReportPage
      title="GSTR-1 (Outward Supplies)"
      partyLabel="Customer"
      fetchReport={saleApi.getGstr1Report}
      fileBase="GSTR1_Report"
    />
  );
}
