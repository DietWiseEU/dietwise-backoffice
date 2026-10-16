import { apiFetch } from '@/api/client';
import { type Language, type TranslationState } from '@/components/referenceData';
import { type RecommendationColumn } from '@/recommendations/recommendations';

/** One Trigger Ingredient row of the grid of components for scoring: its effective name, whether a published master
 * row exists, the Working Copy version a subsequent name/explanation edit must be based on, its per-language translation
 * completeness, and its links to the grid columns. */
export interface TriggerIngredientRow {
	id: string;
	name: string;
	published: boolean;
	version: number;
	translations: Record<Language, TranslationState>;
	/** Recommendation ids this Trigger Ingredient is linked to in published master (restricted to the grid columns). */
	linkedRecommendationIds: string[];
	/** Recommendation ids whose link carries a pending change in the Working Copy; a column's effective presence is the
	 * master link toggled by a staged change (staged-but-not-master = staged addition, staged-and-master = staged removal). */
	stagedRecommendationIds: string[];
	/** Recommendation ids of the Trigger Ingredient's active Rules. Recipe assessment always counts the Recommendation
	 * of the Rule it selects as the primary component, so these links cannot be removed; empty for a Trigger Ingredient
	 * without active Rules, which only contributes to the score of a recipe. */
	ruleRecommendationIds: string[];
}

/** The whole grid of components for scoring: the Recommendation columns and one row per Trigger Ingredient. */
export interface TriggerIngredientGrid {
	columns: RecommendationColumn[];
	triggerIngredients: TriggerIngredientRow[];
}

/** Fetches the grid of components for scoring (master overlaid by the Working Copy): the Recommendation columns and
 * the Trigger Ingredient rows with their links to those columns. */
export function fetchTriggerIngredientGrid(): Promise<TriggerIngredientGrid> {
	return apiFetch<TriggerIngredientGrid>('/trigger-ingredients/recommendations');
}

/**
 * Stages a single Trigger-Ingredient-to-Recommendation link to an absolute target presence in the Working Copy, leaving
 * published master untouched. An unversioned toggle: staging the presence master already has collapses the Staged
 * Change. Rejects with {@link ApiError} status 409 when unlinking the Recommendation of an active Rule.
 */
export function toggleTriggerIngredientRecommendation(
	id: string,
	recommendationId: string,
	present: boolean,
): Promise<void> {
	return apiFetch<void>(`/trigger-ingredients/${id}/recommendations/${recommendationId}`, {
		method: 'PUT',
		body: JSON.stringify({ present }),
	});
}
