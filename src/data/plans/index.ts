import type { PlanTemplateContent } from '../types';
import { PPL_PLAN } from './ppl';
import { BODY_PART_PLAN } from './bodypart';
import { BEGINNER_30_PLAN } from './beginner30';
import { CARDIO_PLAN } from './cardio';

/**
 * Catalogue order. Beginner first on purpose: the member most
 * likely to be looking at this screen is the one who does not yet
 * know what a split is.
 */
export const PLAN_TEMPLATES: PlanTemplateContent[] = [
  BEGINNER_30_PLAN,
  PPL_PLAN,
  BODY_PART_PLAN,
  CARDIO_PLAN,
];

export { PPL_PLAN, BODY_PART_PLAN, BEGINNER_30_PLAN, CARDIO_PLAN };
