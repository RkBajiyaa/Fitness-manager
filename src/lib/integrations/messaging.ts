/* ============================================================
   Messaging seam (docs/ARCHITECTURE.md §J).

   HONESTY RULE: no provider is configured in this phase. Nothing
   in this product may claim a message was delivered when it was
   not. The SimulatedProvider marks messages `simulated` and the
   UI says "logged, not sent".

   Adding WhatsApp Business or email later means implementing
   MessageProvider and registering it — no screen changes.
   ============================================================ */
import type {
  MessageChannel, MessageKind, Member, Membership, Payment,
} from '../types';
import { money, dateShort } from '../format';

export interface OutboundMessage {
  channel: MessageChannel;
  to: string;
  subject: string;
  body: string;
}

export interface DeliveryResult {
  status: 'sent' | 'simulated' | 'failed';
  detail: string;
  at: string;
}

export interface MessageProvider {
  readonly channel: MessageChannel;
  readonly label: string;
  isConfigured(): boolean;
  send(msg: OutboundMessage): Promise<DeliveryResult>;
}

/**
 * The only provider registered today. It records the message and is
 * explicit that nothing left the building.
 */
class SimulatedProvider implements MessageProvider {
  readonly channel: MessageChannel;
  readonly label: string;

  constructor(channel: MessageChannel, label: string) {
    this.channel = channel;
    this.label = label;
  }

  isConfigured(): boolean {
    return false;
  }

  async send(): Promise<DeliveryResult> {
    await new Promise((r) => setTimeout(r, 220));
    return {
      status: 'simulated',
      detail: `${this.label} is not connected. The message was composed and logged, not delivered.`,
      at: new Date().toISOString(),
    };
  }
}

const PROVIDERS: Record<MessageChannel, MessageProvider> = {
  whatsapp: new SimulatedProvider('whatsapp', 'WhatsApp Business'),
  email: new SimulatedProvider('email', 'Email'),
  in_app: new SimulatedProvider('in_app', 'In-app notification'),
};

export function providerFor(channel: MessageChannel): MessageProvider {
  return PROVIDERS[channel];
}

export function anyProviderConfigured(): boolean {
  return Object.values(PROVIDERS).some((p) => p.isConfigured());
}

/* ------------------------------------------------------------
   Templates. A message is composed from a kind plus variables,
   so provider-specific formatting stays out of the screens.
   ------------------------------------------------------------ */

export interface TemplateContext {
  gymName: string;
  member: Member;
  membership?: Membership | null;
  payment?: Payment | null;
  daysLeft?: number;
  amountDue?: number;
  streak?: number;
  achievement?: string;
}

export interface ComposedMessage {
  subject: string;
  body: string;
}

const firstName = (m: Member) => m.name.split(' ')[0];

export const MESSAGE_TEMPLATES: Record<MessageKind, { label: string; description: string }> = {
  payment_receipt: { label: 'Payment receipt', description: 'Confirm money received' },
  renewal_reminder: { label: 'Renewal reminder', description: 'Membership expiring soon' },
  welcome: { label: 'Welcome', description: 'New member onboarding' },
  program_assigned: { label: 'Program assigned', description: 'A new training plan is ready' },
  congratulations: { label: 'Congratulations', description: 'Streak or personal record' },
  custom: { label: 'Custom message', description: 'Write your own' },
};

export function compose(kind: MessageKind, ctx: TemplateContext): ComposedMessage {
  const name = firstName(ctx.member);
  switch (kind) {
    case 'payment_receipt':
      return {
        subject: `Payment received — ${ctx.gymName}`,
        body: `Hi ${name}, we've received your payment of ${money(ctx.payment?.amount ?? 0)}`
          + `${ctx.payment ? ` (receipt ${ctx.payment.receiptNo})` : ''}. Thank you.`
          + `${ctx.amountDue && ctx.amountDue > 0 ? ` Your remaining balance is ${money(ctx.amountDue)}.` : ''}`
          + `\n\n— ${ctx.gymName}`,
      };
    case 'renewal_reminder':
      return {
        subject: `Your membership expires soon — ${ctx.gymName}`,
        body: `Hi ${name}, your ${ctx.membership?.planNameSnapshot ?? 'membership'} expires`
          + `${ctx.daysLeft != null ? ` in ${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'}` : ''}`
          + `${ctx.membership ? ` on ${dateShort(ctx.membership.endDate)}` : ''}.`
          + ` Speak to us at the studio to renew and keep your training uninterrupted.`
          + `\n\n— ${ctx.gymName}`,
      };
    case 'welcome':
      return {
        subject: `Welcome to ${ctx.gymName}`,
        body: `Hi ${name}, welcome to ${ctx.gymName}. Your membership is active`
          + `${ctx.membership ? ` until ${dateShort(ctx.membership.endDate)}` : ''}.`
          + ` Your first sessions are already waiting in the app — open it and you'll see exactly`
          + ` what to do on day one.\n\n— ${ctx.gymName}`,
      };
    case 'program_assigned':
      return {
        subject: `Your new training program is ready`,
        body: `Hi ${name}, your coach has assigned you a new training program.`
          + ` Open the app to see today's session.\n\n— ${ctx.gymName}`,
      };
    case 'congratulations':
      return {
        subject: `Great work, ${name}`,
        body: `Hi ${name}, ${ctx.achievement ?? `you're on a ${ctx.streak ?? 0}-day training streak`}.`
          + ` Consistency like this is exactly what produces results. Keep going.`
          + `\n\n— ${ctx.gymName}`,
      };
    default:
      return { subject: '', body: '' };
  }
}
