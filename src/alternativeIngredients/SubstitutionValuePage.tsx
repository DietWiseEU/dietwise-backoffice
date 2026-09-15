import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiTrash2, FiX } from 'react-icons/fi';
import { ApiError } from '@/api/client';
import { isTooLong, MAX_LENGTHS } from '@/api/fieldLimits';
import { type Language, LANGUAGES } from '@/components/referenceData';
import { TooLongError } from '@/components/TooLongError';
import { ReferenceEditDialog } from '@/components/ReferenceEditDialog';
import { ReferenceTranslationsDialog } from '@/components/ReferenceTranslationsDialog';
import { TranslationChips } from '@/components/TranslationChips';
import {
	type AlternativeIngredientDetails,
	type AlternativeIngredientRow,
	type RecommendationColumn,
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

type CellState = { present: boolean; pendingAdd: boolean; pendingRemove: boolean };

// A column's effective presence is the master link toggled by any staged change. A staged id absent from master is a
// staged addition (the link will appear); a staged id present in master is a staged removal (the link will disappear).
function cellState(row: AlternativeIngredientRow, columnId: string): CellState {
	const master = row.linkedRecommendationIds.includes(columnId);
	const staged = row.stagedRecommendationIds.includes(columnId);
	return { present: master !== staged, pendingAdd: staged && !master, pendingRemove: staged && master };
}

function cellClass({ pendingAdd, pendingRemove }: CellState): string {
	const base = 'btn btn-ghost btn-xs btn-square w-full';
	if (pendingAdd) {
		return `${base} bg-success/20 text-success`;
	}
	if (pendingRemove) {
		return `${base} bg-error/20 text-error`;
	}
	return base;
}

// The sign tells apart the components that raise a recipe's score (+, ENCOURAGED) from those that lower it (-, LIMITED).
function columnSign({ typeOfRecommendation }: RecommendationColumn): string {
	return typeOfRecommendation === 'LIMITED' ? '-' : '+';
}

export function SubstitutionValuePage() {
	const { t } = useTranslation();
	const [grid, setGrid] = useState<RecommendationGrid | null>(null);
	const [failed, setFailed] = useState(false);
	const [conflict, setConflict] = useState(false);
	const [discardBlocked, setDiscardBlocked] = useState(false);
	const [newName, setNewName] = useState('');
	const [duplicateName, setDuplicateName] = useState(false);
	const [creating, setCreating] = useState(false);
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
		commit(() => toggleRecommendation(row.id, columnId, !present));

	const onCreate = async () => {
		const name = newName.trim();
		if (name === '' || creating) {
			return;
		}
		setCreating(true);
		try {
			await createAlternativeIngredient(name);
			setNewName('');
			setDuplicateName(false);
			setConflict(false);
			reload();
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				setDuplicateName(true);
			} else {
				setFailed(true);
			}
		} finally {
			setCreating(false);
		}
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
				<table className="table table-pin-rows">
					<thead>
						<tr>
							<th className="sticky left-0 z-20 bg-base-100 px-1 py-4">
								{t('substitutionValue.columnName')}
							</th>
							<th className="px-1 py-4">{t('substitutionValue.columnTranslations')}</th>
							{grid.columns.map((column) => (
								<th
									key={column.id}
									className="px-1 py-4 text-center align-bottom"
									title={`${column.componentForScoring}: ${column.typeOfRecommendation}`}
								>
									{`${columnSign(column)} ${column.componentForScoring}`}
								</th>
							))}
							<th className="px-1 py-4">
								<span className="sr-only">{t('substitutionValue.columnActions')}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{grid.ingredients.map((row) => (
							<tr key={row.id}>
								<th scope="row" className="sticky left-0 z-10 bg-base-100 px-1 py-1 font-normal">
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
								</th>
								<td className="px-1 py-1">
									<button
										type="button"
										className="flex cursor-pointer gap-1"
										aria-label={`${t('substitutionValue.editTranslations')} ${row.name}`}
										onClick={() => setTranslating({ id: row.id, name: row.name })}
									>
										<TranslationChips languages={LANGUAGES} states={row.translations} />
									</button>
								</td>
								{grid.columns.map((column) => {
									const state = cellState(row, column.id);
									return (
										<td key={column.id} className="px-1 py-1 text-center">
											<button
												type="button"
												className={cellClass(state)}
												aria-pressed={state.present}
												aria-label={`${t('substitutionValue.toggleCell')} ${row.name} / ${column.componentForScoring}`}
												title={`${row.name}: ${column.componentForScoring}`}
												onClick={() => onToggle(row, column.id, state.present)}
											>
												{state.present ? <FiX aria-hidden /> : null}
											</button>
										</td>
									);
								})}
								<td className="px-1 py-1">
									{!row.published ? (
										<button
											type="button"
											className="btn btn-ghost text-error btn-xs"
											aria-label={`${t('substitutionValue.discardIngredient')} ${row.name}`}
											onClick={() => onDiscard(row.id)}
										>
											<FiTrash2 aria-hidden />
										</button>
									) : null}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<input
					type="text"
					className={`input-bordered input input-sm ${isTooLong(newName, MAX_LENGTHS.referenceName) ? 'border-error' : ''}`}
					aria-label={t('substitutionValue.addLabel')}
					placeholder={t('substitutionValue.addPlaceholder')}
					value={newName}
					onChange={(event) => {
						setNewName(event.target.value);
						setDuplicateName(false);
					}}
				/>
				<button
					type="button"
					className="btn btn-primary btn-sm"
					disabled={newName.trim() === '' || isTooLong(newName, MAX_LENGTHS.referenceName) || creating}
					onClick={onCreate}
				>
					{t('substitutionValue.add')}
				</button>
				<TooLongError value={newName} max={MAX_LENGTHS.referenceName} />
				{duplicateName ? (
					<span className="text-sm text-error">{t('substitutionValue.duplicateName')}</span>
				) : null}
			</div>
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
