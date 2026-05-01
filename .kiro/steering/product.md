# Product: HU Student Debt System

A student debt management platform for Hawassa University (Ethiopia). It tracks cost-sharing obligations under Ethiopian Council of Ministers Regulation No. 447/2024, which requires students to repay a portion of tuition, boarding, and food costs after graduation.

## Core Capabilities

- **Debt tracking**: Students view their current balance, payment history, and repayment progress
- **Cost-sharing statement**: Breakdown of tuition share (15%), boarding, and food costs per academic year
- **Payment submission**: Students submit payments via Chapa (online) or manual receipt upload
- **Finance officer dashboard**: Finance staff review, approve, or reject submitted payments
- **Withdrawal workflow**: Students request withdrawal; routed through department head → registrar approval
- **Push notifications**: Firebase Cloud Messaging alerts for payment status changes
- **PDF export**: Students can download their cost-sharing statement as a PDF

## Payment Models

- `post_graduation` – default; student repays after graduating
- `pre_payment` – student paid upfront; cleared against that record
- `hybrid` – combination of both

## User Roles

| Role | Description |
|------|-------------|
| `student` | Views debt, submits payments, requests withdrawal |
| `finance` | Reviews and approves/rejects payments |
| `registrar` | Approves withdrawal requests |
| `department_head` | First-stage withdrawal approval |
| `admin` | Full system access |

## Policy Notes

- Tuition student share = 15% of full tuition
- Living stipend applies only to students with `CASH_STIPEND` living arrangement
- Living stipend = 3,000 ETB × 5 months = 15,000 ETB per semester
- Graduation clearance requires zero balance on all debts
