import { type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { TypeOfRecommendationIcon } from '@/components/TypeOfRecommendationIcon';

/** One column of a grid of links to Recommendations, labelled in the header by the Recommendation's component for
 * scoring. An ENCOURAGED component raises a recipe's score, a LIMITED one lowers it. */
export interface RecommendationLinkColumn {
	id: string;
	componentForScoring: string;
	typeOfRecommendation: 'ENCOURAGED' | 'LIMITED';
}

/** One row of a grid of links to Recommendations: the thing being linked and its links to the grid columns. */
export interface RecommendationLinkRow {
	id: string;
	name: string;
	/** Recommendation ids this row is linked to in published master (restricted to the grid columns). */
	linkedRecommendationIds: string[];
	/** Recommendation ids whose link carries a pending change in the Working Copy; a column's effective presence is the
	 * master link toggled by a staged change (staged-but-not-master = staged addition, staged-and-master = staged removal). */
	stagedRecommendationIds: string[];
}

/** A non-link column of the grid, rendered before or after the link cells. */
export interface RecommendationLinkGridColumn<R> {
	key: string;
	header: ReactNode;
	render: (row: R) => ReactNode;
}

interface RecommendationLinkGridProps<R extends RecommendationLinkRow> {
	columns: RecommendationLinkColumn[];
	rows: R[];
	nameHeader: string;
	renderName: (row: R) => ReactNode;
	leadingColumns?: RecommendationLinkGridColumn<R>[];
	trailingColumns?: RecommendationLinkGridColumn<R>[];
	/** Prefix of each cell's accessible label, followed by the row name and the component for scoring. */
	toggleLabel: string;
	/** The links of a row that are always present and cannot be toggled; none when omitted. */
	lockedRecommendationIds?: (row: R) => string[];
	/** Explains, in the title of a locked cell, why it cannot be toggled. */
	lockedTitle?: string;
	/** Called with the target presence of the link: the opposite of the cell's effective presence. */
	onToggle: (row: R, columnId: string, present: boolean) => void;
}

type CellState = { present: boolean; pendingAdd: boolean; pendingRemove: boolean; locked: boolean };

// A column's effective presence is the master link toggled by any staged change. A staged id absent from master is a
// staged addition (the link will appear); a staged id present in master is a staged removal (the link will disappear).
function cellState(row: RecommendationLinkRow, columnId: string, locked: boolean): CellState {
	if (locked) {
		return { present: true, pendingAdd: false, pendingRemove: false, locked };
	}
	const master = row.linkedRecommendationIds.includes(columnId);
	const staged = row.stagedRecommendationIds.includes(columnId);
	return { present: master !== staged, pendingAdd: staged && !master, pendingRemove: staged && master, locked };
}

function cellClass({ pendingAdd, pendingRemove, locked }: CellState): string {
	const base = 'btn btn-ghost btn-xs btn-square w-full';
	if (locked) {
		return `${base} btn-disabled`;
	}
	if (pendingAdd) {
		return `${base} bg-success/20 text-success`;
	}
	if (pendingRemove) {
		return `${base} bg-error/20 text-error`;
	}
	return base;
}

// Short header labels for the components for scoring whose names would make their column disproportionately wide; the
// full name stays in the header's title and the cells' labels. Keyed by the English master value.
const COMPONENT_ABBREVIATIONS: Record<string, string> = {
	'omega-6 polyunsaturated fatty acids': 'omega-6',
	'seafood omega-3 fatty acids': 'omega-3',
	'sugar-sweetened beverages': 'sugar beverages',
};

function columnLabel({ componentForScoring }: RecommendationLinkColumn): string {
	return COMPONENT_ABBREVIATIONS[componentForScoring] ?? componentForScoring;
}

/**
 * A grid of staged links from rows (e.g. Alternative or Trigger Ingredients) to the Recommendations in its columns: one
 * toggle cell per row and column showing the effective presence of the link and whether it carries a pending change.
 * The row-specific cells (name, translations, actions) are rendered by the caller.
 */
export function RecommendationLinkGrid<R extends RecommendationLinkRow>({
	columns,
	rows,
	nameHeader,
	renderName,
	leadingColumns = [],
	trailingColumns = [],
	toggleLabel,
	lockedRecommendationIds,
	lockedTitle,
	onToggle,
}: RecommendationLinkGridProps<R>) {
	return (
		<table className="table table-pin-rows">
			<thead>
				<tr>
					<th className="sticky left-0 z-20 bg-base-100 px-1 py-4">{nameHeader}</th>
					{leadingColumns.map((column) => (
						<th key={column.key} className="px-1 py-4">
							{column.header}
						</th>
					))}
					{columns.map((column) => (
						<th
							key={column.id}
							className="px-1 py-4 text-center align-bottom"
							title={`${column.componentForScoring}: ${column.typeOfRecommendation}`}
						>
							<span className="inline-flex items-end gap-1">
								<TypeOfRecommendationIcon
									typeOfRecommendation={column.typeOfRecommendation}
									withTitle={false}
								/>
								{columnLabel(column)}
							</span>
						</th>
					))}
					{trailingColumns.map((column) => (
						<th key={column.key} className="px-1 py-4">
							{column.header}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => {
					const locked = lockedRecommendationIds?.(row) ?? [];
					return (
						<tr key={row.id}>
							<th scope="row" className="sticky left-0 z-10 bg-base-100 px-1 py-1 font-normal">
								{renderName(row)}
							</th>
							{leadingColumns.map((column) => (
								<td key={column.key} className="px-1 py-1">
									{column.render(row)}
								</td>
							))}
							{columns.map((column) => {
								const state = cellState(row, column.id, locked.includes(column.id));
								const title = `${row.name}: ${column.componentForScoring}`;
								return (
									<td key={column.id} className="px-1 py-1 text-center">
										<button
											type="button"
											className={cellClass(state)}
											aria-pressed={state.present}
											aria-label={`${toggleLabel} ${row.name} / ${column.componentForScoring}`}
											title={state.locked ? `${title} (${lockedTitle})` : title}
											disabled={state.locked}
											onClick={() => onToggle(row, column.id, !state.present)}
										>
											{state.present ? <FiX aria-hidden /> : null}
										</button>
									</td>
								);
							})}
							{trailingColumns.map((column) => (
								<td key={column.key} className="px-1 py-1">
									{column.render(row)}
								</td>
							))}
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
