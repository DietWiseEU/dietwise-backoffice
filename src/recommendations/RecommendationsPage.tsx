import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiThumbsDown, FiThumbsUp } from 'react-icons/fi';
import { ApiError } from '@/api/client';
import { isTooLong, MAX_LENGTHS } from '@/api/fieldLimits';
import { TooLongError } from '@/components/TooLongError';
import {
	type Language,
	LANGUAGES,
	type Recommendation,
	type TypeOfRecommendation,
	fetchRecommendations,
	fetchRecommendationTranslations,
	revertMaster,
	revertRecommendationTranslation,
	stageMaster,
	stageRecommendationTranslation,
} from '@/recommendations/recommendations';
import { TranslationChips } from '@/components/TranslationChips';
import { RecommendationTranslationsDialog } from '@/recommendations/components/RecommendationTranslationsDialog';

type TranslationTarget = {
	recommendationId: string;
	englishName: string;
	englishComponent: string;
	englishExplanation: string | null;
	englishHumanFriendlyDisplay: string | null;
};

type MasterField = 'explanation' | 'humanFriendlyDisplay';

const MASTER_FIELD_MAX_LENGTHS: Record<MasterField, number> = {
	explanation: MAX_LENGTHS.recommendationExplanation,
	humanFriendlyDisplay: MAX_LENGTHS.recommendationHumanFriendlyDisplay,
};

type MasterDraft = { explanation: string; humanFriendlyDisplay: string };

function TypeOfRecommendationIcon({
	typeOfRecommendation,
	label,
}: {
	typeOfRecommendation: TypeOfRecommendation;
	label: string;
}) {
	const encouraged = typeOfRecommendation === 'ENCOURAGED';
	return (
		<span role="img" aria-label={label} title={label} className="inline-flex text-lg">
			{encouraged ? (
				<FiThumbsUp className="text-success" aria-hidden />
			) : (
				<FiThumbsDown className="text-error" aria-hidden />
			)}
		</span>
	);
}

export function RecommendationsPage() {
	const { t } = useTranslation();
	const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
	const [drafts, setDrafts] = useState<Record<string, MasterDraft>>({});
	const [failed, setFailed] = useState(false);
	const [conflict, setConflict] = useState(false);
	const [translating, setTranslating] = useState<TranslationTarget | null>(null);

	const reload = useCallback(() => {
		fetchRecommendations()
			.then((loaded) => {
				setRecommendations(loaded);
				setDrafts({});
				setFailed(false);
			})
			.catch(() => setFailed(true));
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	// Runs a staging or reverting action, then refreshes the grid so highlights and chips reflect the new state; a stale
	// base version (409) warns and refreshes too, never a silent retry. Any open dialog reconciles its own state.
	const commit = async (action: () => Promise<unknown>) => {
		try {
			await action();
			setConflict(false);
			reload();
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				setConflict(true);
				reload();
			} else {
				setFailed(true);
			}
		}
	};

	const onDraftChange = (recommendation: Recommendation, field: MasterField, value: string) => {
		setDrafts((current) => {
			const existing = current[recommendation.id] ?? {
				explanation: recommendation.explanationForLlm ?? '',
				humanFriendlyDisplay: recommendation.humanFriendlyDisplay ?? '',
			};
			return { ...current, [recommendation.id]: { ...existing, [field]: value } };
		});
	};

	// The explanation and human friendly display are one Working Copy row sharing a version, so committing either sends
	// both values against that version; the field not being edited keeps its last-saved value.
	const commitMasterField = (recommendation: Recommendation, field: MasterField, value: string) => {
		const effective =
			field === 'explanation' ? recommendation.explanationForLlm : recommendation.humanFriendlyDisplay;
		if (value === (effective ?? '') || isTooLong(value, MASTER_FIELD_MAX_LENGTHS[field])) {
			return;
		}
		return commit(() =>
			stageMaster(
				recommendation.id,
				field === 'explanation' ? value : recommendation.explanationForLlm,
				field === 'humanFriendlyDisplay' ? value : recommendation.humanFriendlyDisplay,
				recommendation.version,
			),
		);
	};

	const commitRevertMaster = (recommendation: Recommendation) =>
		commit(() => revertMaster(recommendation.id, recommendation.version));

	const commitStageTranslation = (
		recommendationId: string,
		lang: Language,
		name: string | null,
		componentForScoring: string | null,
		explanationForLlm: string | null,
		humanFriendlyDisplay: string | null,
		baseVersion: number,
	) =>
		commit(() =>
			stageRecommendationTranslation(
				recommendationId,
				lang,
				name,
				componentForScoring,
				explanationForLlm,
				humanFriendlyDisplay,
				baseVersion,
			),
		);

	const commitRevertTranslation = (recommendationId: string, lang: Language, baseVersion: number) =>
		commit(() => revertRecommendationTranslation(recommendationId, lang, baseVersion));

	if (failed) {
		return (
			<div className="alert alert-error">
				<span>{t('recommendations.loadError')}</span>
			</div>
		);
	}

	if (recommendations === null) {
		return <span className="loading loading-lg loading-spinner" aria-label={t('recommendations.loading')} />;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<h1 className="mb-4 text-2xl font-semibold">{t('recommendations.title')}</h1>
			{conflict ? (
				<div className="mb-4 alert alert-warning">
					<span>{t('recommendations.staleReload')}</span>
				</div>
			) : null}
			<div className="min-h-0 flex-1 overflow-auto">
				<table className="table table-pin-rows min-w-[880px]">
					<thead>
						<tr>
							<th className="w-8 px-1 py-4 text-center">
								<span className="sr-only">{t('recommendations.columnTypeOfRecommendation')}</span>
							</th>
							<th className="px-1 py-4">{t('recommendations.columnName')}</th>
							<th className="px-1 py-4">{t('recommendations.columnComponent')}</th>
							<th className="px-1 py-4">{t('recommendations.columnExplanation')}</th>
							<th className="px-1 py-4">{t('recommendations.columnHumanFriendlyDisplay')}</th>
							<th className="px-1 py-4">{t('recommendations.columnTranslations')}</th>
						</tr>
					</thead>
					<tbody>
						{recommendations.map((recommendation) => {
							const explanation =
								drafts[recommendation.id]?.explanation ?? recommendation.explanationForLlm ?? '';
							const humanFriendlyDisplay =
								drafts[recommendation.id]?.humanFriendlyDisplay ??
								recommendation.humanFriendlyDisplay ??
								'';
							return (
								<tr key={recommendation.id}>
									<td className="px-1 py-1 text-center">
										<TypeOfRecommendationIcon
											typeOfRecommendation={recommendation.typeOfRecommendation}
											label={
												recommendation.typeOfRecommendation === 'ENCOURAGED'
													? t('recommendations.typeOfRecommendationEncouraged')
													: t('recommendations.typeOfRecommendationLimited')
											}
										/>
									</td>
									<td className="px-1 py-1">{recommendation.name}</td>
									<td className="px-1 py-1">{recommendation.componentForScoring}</td>
									<td className="px-1 py-1">
										<div className="flex items-center gap-2">
											<input
												type="text"
												className={`input-bordered input min-w-0 flex-1 input-sm ${
													isTooLong(explanation, MAX_LENGTHS.recommendationExplanation)
														? 'border-error'
														: recommendation.explanationChanged
															? 'border-warning bg-warning/10'
															: ''
												}`}
												value={
													drafts[recommendation.id]?.explanation ??
													recommendation.explanationForLlm ??
													''
												}
												aria-label={t('recommendations.explanationEditLabel')}
												onChange={(event) =>
													onDraftChange(recommendation, 'explanation', event.target.value)
												}
												onBlur={(event) =>
													commitMasterField(recommendation, 'explanation', event.target.value)
												}
											/>
											{recommendation.explanationChanged ||
											recommendation.humanFriendlyDisplayChanged ? (
												<button
													type="button"
													className="btn btn-ghost btn-xs"
													onClick={() => commitRevertMaster(recommendation)}
												>
													{t('recommendations.revert')}
												</button>
											) : null}
										</div>
										<TooLongError value={explanation} max={MAX_LENGTHS.recommendationExplanation} />
									</td>
									<td className="px-1 py-1">
										<input
											type="text"
											className={`input-bordered input w-full min-w-0 input-sm ${
												isTooLong(
													humanFriendlyDisplay,
													MAX_LENGTHS.recommendationHumanFriendlyDisplay,
												)
													? 'border-error'
													: recommendation.humanFriendlyDisplayChanged
														? 'border-warning bg-warning/10'
														: ''
											}`}
											value={humanFriendlyDisplay}
											aria-label={t('recommendations.humanFriendlyDisplayEditLabel')}
											onChange={(event) =>
												onDraftChange(
													recommendation,
													'humanFriendlyDisplay',
													event.target.value,
												)
											}
											onBlur={(event) =>
												commitMasterField(
													recommendation,
													'humanFriendlyDisplay',
													event.target.value,
												)
											}
										/>
										<TooLongError
											value={humanFriendlyDisplay}
											max={MAX_LENGTHS.recommendationHumanFriendlyDisplay}
										/>
									</td>
									<td className="px-1 py-1">
										<button
											type="button"
											className="flex cursor-pointer gap-1"
											aria-label={t('recommendations.editTranslations')}
											onClick={() =>
												setTranslating({
													recommendationId: recommendation.id,
													englishName: recommendation.name,
													englishComponent: recommendation.componentForScoring,
													englishExplanation: recommendation.explanationForLlm,
													englishHumanFriendlyDisplay: recommendation.humanFriendlyDisplay,
												})
											}
										>
											<TranslationChips
												languages={LANGUAGES}
												states={recommendation.translations}
											/>
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{translating !== null ? (
				<RecommendationTranslationsDialog
					recommendationId={translating.recommendationId}
					englishName={translating.englishName}
					englishComponent={translating.englishComponent}
					englishExplanation={translating.englishExplanation}
					englishHumanFriendlyDisplay={translating.englishHumanFriendlyDisplay}
					loadTranslations={fetchRecommendationTranslations}
					onStage={(lang, name, componentForScoring, explanationForLlm, humanFriendlyDisplay, baseVersion) =>
						commitStageTranslation(
							translating.recommendationId,
							lang,
							name,
							componentForScoring,
							explanationForLlm,
							humanFriendlyDisplay,
							baseVersion,
						)
					}
					onRevert={(lang, baseVersion) =>
						commitRevertTranslation(translating.recommendationId, lang, baseVersion)
					}
					onCancel={() => setTranslating(null)}
				/>
			) : null}
		</div>
	);
}
