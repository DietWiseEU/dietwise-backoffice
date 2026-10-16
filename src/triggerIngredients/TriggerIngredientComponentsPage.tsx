import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import { NewReferenceForm } from '@/components/NewReferenceForm';
import { RecommendationLinkGrid } from '@/components/RecommendationLinkGrid';
import { type Language, LANGUAGES } from '@/components/referenceData';
import { ReferenceEditDialog } from '@/components/ReferenceEditDialog';
import { ReferenceTranslationsDialog } from '@/components/ReferenceTranslationsDialog';
import { TranslationChips } from '@/components/TranslationChips';
import {
	createTriggerIngredient,
	editTriggerIngredient,
	fetchTriggerIngredient,
	fetchTriggerIngredientTranslations,
	revertTriggerIngredient,
	revertTriggerIngredientTranslation,
	stageTriggerIngredientTranslation,
} from '@/rules/rules';
import {
	type TriggerIngredientGrid,
	type TriggerIngredientRow,
	fetchTriggerIngredientGrid,
	toggleTriggerIngredientRecommendation,
} from '@/triggerIngredients/triggerIngredients';

/**
 * The components for scoring of every Trigger Ingredient: which Recommendations' components a recipe ingredient
 * matched to it contributes to the score of the recipe. The Recommendations of a Trigger Ingredient's active Rules are
 * always counted, so their cells are locked; a Trigger Ingredient without active Rules only contributes to the score.
 * This is also the one place listing every Trigger Ingredient, including those no Rule references yet.
 */
export function TriggerIngredientComponentsPage() {
	const { t } = useTranslation();
	const [grid, setGrid] = useState<TriggerIngredientGrid | null>(null);
	const [failed, setFailed] = useState(false);
	const [conflict, setConflict] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [translating, setTranslating] = useState<{ id: string; name: string } | null>(null);

	const reload = useCallback(() => {
		fetchTriggerIngredientGrid()
			.then((loaded) => {
				setGrid(loaded);
				setFailed(false);
			})
			.catch(() => setFailed(true));
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	// Every staged write refreshes the grid so the cells, chips and badges reflect the new state. A 409 — a stale base
	// version, or unlinking a component a Rule assigned since the grid was loaded — warns and refreshes too.
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

	const onToggle = (row: TriggerIngredientRow, columnId: string, present: boolean) =>
		commit(() => toggleTriggerIngredientRecommendation(row.id, columnId, present));

	const onCreate = async (name: string) => {
		await createTriggerIngredient(name);
		setConflict(false);
		reload();
	};

	const commitEdit = (id: string, name: string, explanationForLlm: string | null, baseVersion: number) => {
		setEditingId(null);
		return commit(() => editTriggerIngredient(id, name, explanationForLlm, baseVersion));
	};

	const commitRevert = (id: string, baseVersion: number) => {
		setEditingId(null);
		return commit(() => revertTriggerIngredient(id, baseVersion));
	};

	const commitStageTranslation = (
		id: string,
		lang: Language,
		name: string | null,
		explanationForLlm: string | null,
		baseVersion: number,
	) => commit(() => stageTriggerIngredientTranslation(id, lang, name, explanationForLlm, baseVersion));

	const commitRevertTranslation = (id: string, lang: Language, baseVersion: number) =>
		commit(() => revertTriggerIngredientTranslation(id, lang, baseVersion));

	if (failed) {
		return (
			<div className="alert alert-error">
				<span>{t('triggerIngredients.loadError')}</span>
			</div>
		);
	}

	if (grid === null) {
		return <span className="loading loading-lg loading-spinner" aria-label={t('triggerIngredients.loading')} />;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<h1 className="mb-4 text-2xl font-semibold">{t('triggerIngredients.title')}</h1>
			{conflict ? (
				<div className="mb-4 alert alert-warning">
					<span>{t('triggerIngredients.staleReload')}</span>
				</div>
			) : null}
			<div className="min-h-0 flex-1 overflow-auto">
				<RecommendationLinkGrid
					columns={grid.columns}
					rows={grid.triggerIngredients}
					nameHeader={t('triggerIngredients.columnName')}
					renderName={(row) => (
						<>
							<button
								type="button"
								className="link text-left link-hover"
								aria-label={`${t('triggerIngredients.editTriggerIngredient')} ${row.name}`}
								onClick={() => setEditingId(row.id)}
							>
								{row.name}
							</button>
							{!row.published ? (
								<span className="ml-2 badge badge-sm badge-info">
									{t('triggerIngredients.newBadge')}
								</span>
							) : row.version > 0 ? (
								<span className="ml-2 badge badge-sm badge-warning">
									{t('triggerIngredients.pendingBadge')}
								</span>
							) : null}
							{row.ruleRecommendationIds.length === 0 ? (
								<span
									className="ml-2 badge badge-ghost badge-sm"
									title={t('triggerIngredients.scoringOnlyHint')}
								>
									{t('triggerIngredients.scoringOnlyBadge')}
								</span>
							) : null}
						</>
					)}
					leadingColumns={[
						{
							key: 'translations',
							header: t('triggerIngredients.columnTranslations'),
							render: (row) => (
								<button
									type="button"
									className="flex cursor-pointer gap-1"
									aria-label={`${t('triggerIngredients.editTranslations')} ${row.name}`}
									onClick={() => setTranslating({ id: row.id, name: row.name })}
								>
									<TranslationChips languages={LANGUAGES} states={row.translations} />
								</button>
							),
						},
					]}
					toggleLabel={t('triggerIngredients.toggleCell')}
					lockedRecommendationIds={(row) => row.ruleRecommendationIds}
					lockedTitle={t('triggerIngredients.lockedByRule')}
					onToggle={onToggle}
				/>
			</div>
			<NewReferenceForm
				label={t('triggerIngredients.addLabel')}
				placeholder={t('triggerIngredients.addPlaceholder')}
				addText={t('triggerIngredients.add')}
				duplicateText={t('triggerIngredients.duplicateName')}
				onCreate={onCreate}
				onFailure={() => setFailed(true)}
			/>
			{editingId !== null ? (
				<ReferenceEditDialog
					referenceId={editingId}
					title={t('triggerIngredients.editTriggerIngredient')}
					blastRadius={null}
					takenNames={grid.triggerIngredients
						.filter((triggerIngredient) => triggerIngredient.id !== editingId)
						.map((triggerIngredient) => triggerIngredient.name.toLowerCase())}
					loadDetails={fetchTriggerIngredient}
					onSubmit={(name, explanationForLlm, baseVersion) =>
						commitEdit(editingId, name, explanationForLlm, baseVersion)
					}
					onRevert={(baseVersion) => commitRevert(editingId, baseVersion)}
					onCancel={() => setEditingId(null)}
				/>
			) : null}
			{translating !== null ? (
				<ReferenceTranslationsDialog
					referenceId={translating.id}
					title={t('triggerIngredients.editTriggerTranslations')}
					englishName={translating.name}
					loadTranslations={fetchTriggerIngredientTranslations}
					onStage={(lang, name, explanationForLlm, baseVersion) =>
						commitStageTranslation(translating.id, lang, name, explanationForLlm, baseVersion)
					}
					onRevert={(lang, baseVersion) => commitRevertTranslation(translating.id, lang, baseVersion)}
					onCancel={() => setTranslating(null)}
				/>
			) : null}
		</div>
	);
}
