import { PageHeader } from '../_shared/PageHeader';
import { useFabActions } from '../../layouts/useFab';
import { useStandardFabActions } from '../../layouts/useStandardFabActions';
import { HoursTableMonth, type HoursMonthRow } from '../../components/HoursTableMonth';
import { useActionParam } from '../../layouts/useActionParam';
import { notify } from '../../layouts/notice.store';

const HOURS_DATA: HoursMonthRow[] = [
  { month: 1, monthName: 'Janvier', hoursWorked: 150, hoursDue: 145, balance: 5, leavesTaken: 2 },
  { month: 2, monthName: 'Février', hoursWorked: 142, hoursDue: 140, balance: 2, leavesTaken: 0 },
  { month: 3, monthName: 'Mars', hoursWorked: 145, hoursDue: 145, balance: 0, leavesTaken: 0 },
  { month: 4, monthName: 'Avril', hoursWorked: 148, hoursDue: 145, balance: 3, leavesTaken: 1 },
  {
    month: 5,
    monthName: 'Mai',
    hoursWorked: 152,
    hoursDue: 147,
    balance: 5,
    leavesTaken: 0,
    isCurrentMonth: true,
  },
];

export default function MesHeuresPage() {
  // FAB unifié : "Saisir une présence" est l'action mise en avant sur MesHeures.
  useFabActions(useStandardFabActions({ highlight: 'horaires' }));
  useActionParam(({ action }) => {
    if (action === 'export') {
      notify(
        'Export feuille de temps : disponible Phase 3 (PDF mensuel signature employeur).',
        'info',
      );
    } else if (action === 'expense') {
      notify(
        'Note de frais : disponible Phase 3 (formulaire + photo justificatif + Odoo hr.expense).',
        'info',
      );
    }
  });

  return (
    <>
      <PageHeader title="Mes heures" />
      <HoursTableMonth employeeId="emp-1" year={2026} rows={HOURS_DATA} bordered={false} />
    </>
  );
}
