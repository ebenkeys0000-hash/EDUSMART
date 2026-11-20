import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Lang } from '../../lib/i18n.ts';
import { SubscriptionRuntimeState } from '../../lib/subscriptionCatalog.ts';

export interface TrialCountdownProps {
  subscriptionState: SubscriptionRuntimeState;
  lang: Lang;
  onClick?: () => void;
  className?: string;
}

/**
 * Reusable countdown indicator displaying remaining days in the school's 30-day free trial
 * (or urgent expiry notice when expired) inside top navigation surfaces.
 */
export const TrialCountdown: React.FC<TrialCountdownProps> = ({
  subscriptionState,
  lang,
  onClick,
  className = '',
}) => {
  const { isTrialActive, isTrialExpiringSoon, isSubscriptionExpired, trialDaysRemaining, trialEndsAt } =
    subscriptionState;

  if (!isTrialActive && !isSubscriptionExpired) {
    return null;
  }

  const endDateLabel = trialEndsAt ? trialEndsAt.slice(0, 10) : '';

  const colorClasses = isSubscriptionExpired
    ? 'border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/80'
    : isTrialExpiringSoon
      ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/80'
      : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 text-[#082F5E] dark:text-blue-200 hover:bg-blue-100/80 dark:hover:bg-blue-950/70';

  const iconColor = isSubscriptionExpired
    ? 'text-red-600 dark:text-red-400'
    : isTrialExpiringSoon
      ? 'text-[#E89E0E]'
      : 'text-[#0068C9] dark:text-blue-400';

  const compactLabel = isSubscriptionExpired
    ? lang === 'fr'
      ? 'Essai expiré'
      : 'Trial expired'
    : lang === 'fr'
      ? `${trialDaysRemaining}j restant${trialDaysRemaining > 1 ? 's' : ''}`
      : `${trialDaysRemaining}d left`;

  const fullLabel = isSubscriptionExpired
    ? lang === 'fr'
      ? 'Essai expiré · Activer'
      : 'Trial expired · Activate'
    : lang === 'fr'
      ? `Essai · ${trialDaysRemaining} jour${trialDaysRemaining > 1 ? 's' : ''} restant${trialDaysRemaining > 1 ? 's' : ''}`
      : `Trial · ${trialDaysRemaining} day${trialDaysRemaining > 1 ? 's' : ''} left`;

  const titleText = isSubscriptionExpired
    ? lang === 'fr'
      ? 'Essai gratuit terminé — cliquez pour activer un forfait'
      : 'Free trial ended — click to activate a plan'
    : lang === 'fr'
      ? `Essai gratuit de 30 jours : ${trialDaysRemaining} jour(s) restant(s)${endDateLabel ? ` (fin le ${endDateLabel})` : ''}`
      : `30-day free trial: ${trialDaysRemaining} day(s) remaining${endDateLabel ? ` (ends ${endDateLabel})` : ''}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={titleText}
      aria-label={titleText}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${colorClasses} ${className}`}
    >
      {isSubscriptionExpired ? (
        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
      ) : (
        <Clock className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
      )}
      <span className="font-mono-tabular xl:hidden">{compactLabel}</span>
      <span className="hidden xl:inline font-mono-tabular">{fullLabel}</span>
    </button>
  );
};
