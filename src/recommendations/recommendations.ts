import { apiFetch } from '@/api/client';

export type Language = 'EL' | 'LT' | 'NL';

export const LANGUAGES: Language[] = ['EL', 'LT', 'NL'];

export type TranslationState = 'MISSING' | 'PARTIAL' | 'PRESENT' | 'PARTIAL_STAGED' | 'STAGED';

export type TypeOfRecommendation = 'ENCOURAGED' | 'LIMITED';

export interface Recommendation {
	id: string;
	name: string;
	componentForScoring: string;
	typeOfRecommendation: TypeOfRecommendation;
	/** Effective English explanation for the LLM (published master overlaid by any Staged Change); may be empty. */
	explanationForLlm: string | null;
	/** Whether the explanation differs from published master because of a Staged Change. */
	explanationChanged: boolean;
	/** Effective English human friendly display (published master overlaid by any Staged Change); may be empty. */
	humanFriendlyDisplay: string | null;
	/** Whether the human friendly display differs from published master because of a Staged Change. */
	humanFriendlyDisplayChanged: boolean;
	/** Working Copy version to base the next master edit on (0 when there is no Staged Change yet). The explanation and
	 * human friendly display share this version and are staged and reverted together. */
	version: number;
	translations: Record<Language, TranslationState>;
}

export function fetchRecommendations(): Promise<Recommendation[]> {
	return apiFetch<Recommendation[]>('/recommendations');
}

/**
 * Stages a Recommendation's English master text — its explanation for the LLM and human friendly display — in the
 * Working Copy, leaving published master untouched. The two fields share one version and are staged together. Rejects
 * with {@link ApiError} status 409 when the base version is stale (someone changed it since it was loaded).
 */
export function stageMaster(
	id: string,
	explanationForLlm: string | null,
	humanFriendlyDisplay: string | null,
	baseVersion: number,
): Promise<void> {
	return apiFetch<void>(`/recommendations/${id}/master`, {
		method: 'PUT',
		body: JSON.stringify({ explanationForLlm, humanFriendlyDisplay, baseVersion }),
	});
}

/**
 * Reverts a Recommendation's staged master text, restoring the published master values and removing the Staged Change.
 * Rejects with {@link ApiError} status 409 when the base version is stale.
 */
export function revertMaster(id: string, baseVersion: number): Promise<void> {
	return apiFetch<void>(`/recommendations/${id}/master?baseVersion=${baseVersion}`, { method: 'DELETE' });
}

/** The effective translation of a Recommendation in one language (published master overlaid by any Staged Change). The
 * four fields share a single version, so they are staged and reverted together; a field is null when absent. */
export interface RecommendationTranslationDetails {
	name: string | null;
	componentForScoring: string | null;
	explanationForLlm: string | null;
	humanFriendlyDisplay: string | null;
	/** Working Copy version to base the next edit on (0 when there is no Staged Change yet). */
	version: number;
}

/**
 * Fetches the effective translation of a Recommendation for each non-English language (master overlaid by any Staged
 * Change) and the Working Copy version to base an edit on, to pre-fill the translations dialog.
 */
export function fetchRecommendationTranslations(
	id: string,
): Promise<Record<Language, RecommendationTranslationDetails>> {
	return apiFetch<Record<Language, RecommendationTranslationDetails>>(`/recommendations/${id}/translations`);
}

/**
 * Stages a Recommendation's name, component for scoring, explanation and human friendly display translation for one
 * language in the Working Copy, leaving published master untouched. A null field clears that part of the translation.
 * Rejects with {@link ApiError} status 409 when the base version is stale.
 */
export function stageRecommendationTranslation(
	id: string,
	lang: Language,
	name: string | null,
	componentForScoring: string | null,
	explanationForLlm: string | null,
	humanFriendlyDisplay: string | null,
	baseVersion: number,
): Promise<void> {
	return apiFetch<void>(`/recommendations/${id}/translations/${lang}`, {
		method: 'PUT',
		body: JSON.stringify({ name, componentForScoring, explanationForLlm, humanFriendlyDisplay, baseVersion }),
	});
}

/**
 * Reverts a Recommendation's staged translation for one language, restoring the published master translation. Rejects
 * with {@link ApiError} status 409 when the base version is stale.
 */
export function revertRecommendationTranslation(id: string, lang: Language, baseVersion: number): Promise<void> {
	return apiFetch<void>(`/recommendations/${id}/translations/${lang}?baseVersion=${baseVersion}`, {
		method: 'DELETE',
	});
}
