import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiTrash2 } from 'react-icons/fi';
import { ApiError } from '@/api/client';
import { NewReferenceForm } from '@/components/NewReferenceForm';
import { RecommendationLinkGrid } from '@/components/RecommendationLinkGrid';
import { type Language, LANGUAGES } from '@/components/referenceData';
import { ReferenceEditDialog } from '@/components/ReferenceEditDialog';
import { ReferenceTranslationsDialog } from '@/components/ReferenceTranslationsDialog';
import { TranslationChips } from '@/components/TranslationChips';
import {
	type AlternativeIngredientDetails,
	type AlternativeIngredientRow,
	type RecommendationGrid,
	createAlternativeIngredient,
	discardAlternativeIngredient,
	editAlternativeIngredient,
	fetchAlternativeIngredient,
	fetchAlternativeIngredientTranslations,
	fetchRecommendationGrid,
	revertAlternativeIngredient,
	revertAlternativeIngredientTranslation,
	stageAlternativeIngredientTranslation,
	toggleRecommendation,
} from '@/alternativeIngredients/alternativeIngredients';

export function SubstitutionValuePage() {
	const { t } = useTranslation();
	const [grid, setGrid] = useState<RecommendationGrid | null>(null);
	const [failed, setFailed] = useState(false);
	const [conflict, setConflict] = useState(false);
	const [discardBlocked, setDiscardBlocked] = useState(false);
	const [editing, setEditing] = useState<{ id: string; details: AlternativeIngredientDetails } | null>(null);
	const [translating, setTranslating] = useState<{ id: string; name: string } | null>(null);

	const reload = useCallback(() => {
		fetchRecommendationGrid()
			.then((loaded) => {
				setGrid(loaded);
				setFailed(false);
			})
			.catch(() => setFailed(true));
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	// Every staged write refreshes the grid so the cells, chips and badges reflect the new state. A stale base version
	// (a versioned name/explanation/translation edit) warns and refreshes too; the toggle is unversioned and never 409s.
	const commit = async (action: () => Promise<unknown>) => {
		try {
			await action();
			setConflict(false);
			setDiscardBlocked(false);
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

	const onToggle = (row: AlternativeIngredientRow, columnId: string, present: boolean) =>
		commit(() => toggleRecommendation(row.id, columnId, present));

	const onCreate = async (name: string) => {
		await createAlternativeIngredient(name);
		setConflict(false);
		reload();
	};

	// A Working-Copy-only ingredient can be discarded; the server refuses (409) one that is published or still
	// referenced by a Suggestion Template, which we surface as its own notice rather than a stale-edit warning.
	const onDiscard = async (id: string) => {
		try {
			await discardAlternativeIngredient(id);
			setDiscardBlocked(false);
			setConflict(false);
			reload();
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				setDiscardBlocked(true);
				reload();
			} else {
				setFailed(true);
			}
		}
	};

	const openEdit = async (id: string) => {
		try {
			const details = await fetchAlternativeIngredient(id);
			setEditing({ id, details });
		} catch {
			setFailed(true);
		}
	};

	const commitEdit = (id: string, name: string, explanationForLlm: string | null, baseVersion: number) => {
		setEditing(null);
		return commit(() => editAlternativeIngredient(id, name, explanationForLlm, baseVersion));
	};

	const commitRevert = (id: string, baseVersion: number) => {
		setEditing(null);
		return commit(() => revertAlternativeIngredient(id, baseVersion));
	};

	const commitStageTranslation = (
		id: string,
		lang: Language,
		name: string | null,
		explanationForLlm: string | null,
		baseVersion: number,
	) => commit(() => stageAlternativeIngredientTranslation(id, lang, name, explanationForLlm, baseVersion));

	const commitRevertTranslation = (id: string, lang: Language, baseVersion: number) =>
		commit(() => revertAlternativeIngredientTranslation(id, lang, baseVersion));

	if (failed) {
		return (
			<div className="alert alert-error">
				<span>{t('substitutionValue.loadError')}</span>
			</div>
		);
	}

	if (grid === null) {
		return <span className="loading loading-lg loading-spinner" aria-label={t('substitutionValue.loading')} />;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<h1 className="mb-4 text-2xl font-semibold">{t('substitutionValue.title')}</h1>
			{conflict ? (
				<div className="mb-4 alert alert-warning">
					<span>{t('substitutionValue.staleReload')}</span>
				</div>
			) : null}
			{discardBlocked ? (
				<div className="mb-4 alert alert-warning">
					<span>{t('substitutionValue.discardBlocked')}</span>
				</div>
			) : null}
			<div className="min-h-0 flex-1 overflow-auto">
				<RecommendationLinkGrid
					columns={grid.columns}
					rows={grid.ingredients}
					nameHeader={t('substitutionValue.columnName')}
					renderName={(row) => (
						<>
							<button
								type="button"
								className="link text-left link-hover"
								aria-label={`${t('substitutionValue.editAlternativeIngredient')} ${row.name}`}
								onClick={() => openEdit(row.id)}
							>
								{row.name}
							</button>
							{!row.published ? (
								<span className="ml-2 badge badge-sm badge-info">
									{t('substitutionValue.newBadge')}
								</span>
							) : row.version > 0 ? (
								<span className="ml-2 badge badge-sm badge-warning">
									{t('substitutionValue.pendingBadge')}
								</span>
							) : null}
						</>
					)}
					leadingColumns={[
						{
							key: 'translations',
							header: t('substitutionValue.columnTranslations'),
							render: (row) => (
								<button
									type="button"
									className="flex cursor-pointer gap-1"
									aria-label={`${t('substitutionValue.editTranslations')} ${row.name}`}
									onClick={() => setTranslating({ id: row.id, name: row.name })}
								>
									<TranslationChips languages={LANGUAGES} states={row.translations} />
								</button>
							),
						},
					]}
					trailingColumns={[
						{
							key: 'actions',
							header: <span className="sr-only">{t('substitutionValue.columnActions')}</span>,
							render: (row) =>
								!row.published ? (
									<button
										type="button"
										className="btn btn-ghost text-error btn-xs"
										aria-label={`${t('substitutionValue.discardIngredient')} ${row.name}`}
										onClick={() => onDiscard(row.id)}
									>
										<FiTrash2 aria-hidden />
									</button>
								) : null,
						},
					]}
					toggleLabel={t('substitutionValue.toggleCell')}
					onToggle={onToggle}
				/>
			</div>
			<NewReferenceForm
				label={t('substitutionValue.addLabel')}
				placeholder={t('substitutionValue.addPlaceholder')}
				addText={t('substitutionValue.add')}
				duplicateText={t('substitutionValue.duplicateName')}
				onCreate={onCreate}
				onFailure={() => setFailed(true)}
			/>
			{editing !== null ? (
				<ReferenceEditDialog
					referenceId={editing.id}
					title={t('substitutionValue.editAlternativeIngredient')}
					blastRadius={t('substitutionValue.editBlastRadius', { count: editing.details.referenceCount })}
					takenNames={grid.ingredients
						.filter((ingredient) => ingredient.id !== editing.id)
						.map((ingredient) => ingredient.name.toLowerCase())}
					loadDetails={fetchAlternativeIngredient}
					onSubmit={(name, explanationForLlm, baseVersion) =>
						commitEdit(editing.id, name, explanationForLlm, baseVersion)
					}
					onRevert={(baseVersion) => commitRevert(editing.id, baseVersion)}
					onCancel={() => setEditing(null)}
				/>
			) : null}
			{translating !== null ? (
				<ReferenceTranslationsDialog
					referenceId={translating.id}
					title={t('substitutionValue.editAlternativeTranslations')}
					englishName={translating.name}
					loadTranslations={fetchAlternativeIngredientTranslations}
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
