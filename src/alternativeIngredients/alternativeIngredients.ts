import { apiFetch } from '@/api/client';
import {
	type Language,
	type ReferenceDetails,
	type ReferenceOption,
	type TranslationState,
} from '@/components/referenceData';
import { type TypeOfRecommendation } from '@/recommendations/recommendations';

/** The editable details of a shared AlternativeIngredient plus its blast radius — the number of Suggestion Templates,
 * across all Rules, that reference it and would see the edit. Structurally a {@link ReferenceDetails} so it can pre-fill
 * the shared {@link ReferenceDetails} edit dialog directly. */
export interface AlternativeIngredientDetails extends ReferenceDetails {
	referenceCount: number;
}

/** Fetches the AlternativeIngredients an editor can choose (master overlaid by the Working Copy), as id and name, sorted by name. */
export function fetchAlternativeIngredientOptions(): Promise<ReferenceOption[]> {
	return apiFetch<ReferenceOption[]>('/rules/alternative-ingredients');
}

/**
 * Stages a brand-new AlternativeIngredient in the Working Copy with name alone, resolving with its id and name. Rejects
 * with {@link ApiError} status 409 when one with the same name already exists.
 */
export function createAlternativeIngredient(name: string): Promise<ReferenceOption> {
	return apiFetch<ReferenceOption>('/rules/alternative-ingredients', {
		method: 'POST',
		body: JSON.stringify({ name }),
	});
}

/** Fetches the effective details of an AlternativeIngredient (master overlaid by any Staged Change) plus its blast
 * radius, to pre-fill and warn within its edit dialog. */
export function fetchAlternativeIngredient(id: string): Promise<AlternativeIngredientDetails> {
	return apiFetch<AlternativeIngredientDetails>(`/rules/alternative-ingredients/${id}`);
}

/**
 * Stages an edit to a shared AlternativeIngredient's name and explanation in the Working Copy; the change is seen by
 * every referencing Suggestion Template. Rejects with {@link ApiError} status 409 when the base version is stale or the
 * name is taken.
 */
export function editAlternativeIngredient(
	id: string,
	name: string,
	explanationForLlm: string | null,
	baseVersion: number,
): Promise<void> {
	return apiFetch<void>(`/rules/alternative-ingredients/${id}`, {
		method: 'PUT',
		body: JSON.stringify({ name, explanationForLlm, baseVersion }),
	});
}

/**
 * Reverts a shared AlternativeIngredient's staged edit, restoring its published master name and explanation; the change
 * is seen by every referencing Suggestion Template. Rejects with {@link ApiError} status 409 when the base version is stale.
 */
export function revertAlternativeIngredient(id: string, baseVersion: number): Promise<void> {
	return apiFetch<void>(`/rules/alternative-ingredients/${id}?baseVersion=${baseVersion}`, { method: 'DELETE' });
}

/**
 * Fetches the effective translation of a shared AlternativeIngredient for each non-English language (master overlaid by
 * any Staged Change) and the Working Copy version to base an edit on, to pre-fill the translations dialog.
 */
export function fetchAlternativeIngredientTranslations(id: string): Promise<Record<Language, ReferenceDetails>> {
	return apiFetch<Record<Language, ReferenceDetails>>(`/rules/alternative-ingredients/${id}/translations`);
}

/**
 * Stages an AlternativeIngredient's name and explanation translation for one language in the Working Copy. A {@code null}
 * value clears that field (falls back to English). Rejects with {@link ApiError} status 409 when the base version is stale.
 */
export function stageAlternativeIngredientTranslation(
	id: string,
	lang: Language,
	name: string | null,
	explanationForLlm: string | null,
	baseVersion: number,
): Promise<void> {
	return apiFetch<void>(`/rules/alternative-ingredients/${id}/translations/${lang}`, {
		method: 'PUT',
		body: JSON.stringify({ name, explanationForLlm, baseVersion }),
	});
}

/**
 * Reverts an AlternativeIngredient's staged translation for one language, restoring the published master translation.
 * Rejects with {@link ApiError} status 409 when the base version is stale.
 */
export function revertAlternativeIngredientTranslation(id: string, lang: Language, baseVersion: number): Promise<void> {
	return apiFetch<void>(`/rules/alternative-ingredients/${id}/translations/${lang}?baseVersion=${baseVersion}`, {
		method: 'DELETE',
	});
}

/** One column of the substitution-value grid: a Recommendation whose component for scoring an AlternativeIngredient
 * can carry, labelled in the header by that component. Carrying an ENCOURAGED component raises a recipe's score,
 * carrying a LIMITED one lowers it. */
export interface RecommendationColumn {
	id: string;
	componentForScoring: string;
	typeOfRecommendation: TypeOfRecommendation;
}

/** One AlternativeIngredient row of the substitution-value grid: its effective name, whether a published master row
 * exists (false = Working-Copy-only, so it may be discarded), the Working Copy version a subsequent name/explanation
 * edit must be based on, its per-language translation completeness, and its links to the grid columns. */
export interface AlternativeIngredientRow {
	id: string;
	name: string;
	published: boolean;
	version: number;
	translations: Record<Language, TranslationState>;
	/** Recommendation ids this ingredient is linked to in published master (restricted to the grid columns). */
	linkedRecommendationIds: string[];
	/** Recommendation ids whose link carries a pending change in the Working Copy; a column's effective presence is the
	 * master link toggled by a staged change (staged-but-not-master = staged addition, staged-and-master = staged removal). */
	stagedRecommendationIds: string[];
}

/** The whole substitution-value grid: the Recommendation columns and one row per AlternativeIngredient. */
export interface RecommendationGrid {
	columns: RecommendationColumn[];
	ingredients: AlternativeIngredientRow[];
}

/** Fetches the substitution-value grid (master overlaid by the Working Copy): the Recommendation columns and
 * the AlternativeIngredient rows with their links to those columns. */
export function fetchRecommendationGrid(): Promise<RecommendationGrid> {
	return apiFetch<RecommendationGrid>('/alternative-ingredients/recommendations');
}

/**
 * Stages a single AlternativeIngredient-to-Recommendation link to an absolute target presence in the Working Copy,
 * leaving published master untouched. An unversioned toggle: staging the presence master already has collapses the
 * Staged Change, and there is no stale-version check.
 */
export function toggleRecommendation(id: string, recommendationId: string, present: boolean): Promise<void> {
	return apiFetch<void>(`/alternative-ingredients/${id}/recommendations/${recommendationId}`, {
		method: 'PUT',
		body: JSON.stringify({ present }),
	});
}

/**
 * Discards a Working-Copy-only AlternativeIngredient, removing its Working Copy row, staged translations and staged
 * links. Rejects with {@link ApiError} status 409 when it is published or still referenced by a Suggestion Template.
 */
export function discardAlternativeIngredient(id: string): Promise<void> {
	return apiFetch<void>(`/alternative-ingredients/${id}`, { method: 'DELETE' });
}
