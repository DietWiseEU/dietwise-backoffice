import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	type RecommendationLinkColumn,
	type RecommendationLinkRow,
	RecommendationLinkGrid,
} from './RecommendationLinkGrid';

interface Row extends RecommendationLinkRow {
	note: string;
}

const COLUMNS: RecommendationLinkColumn[] = [
	{ id: 'rec-vegetables', componentForScoring: 'vegetables', typeOfRecommendation: 'ENCOURAGED' },
	{ id: 'rec-red-meat', componentForScoring: 'red meat', typeOfRecommendation: 'LIMITED' },
	{ id: 'rec-sodium', componentForScoring: 'sodium', typeOfRecommendation: 'LIMITED' },
];

// Beef: master-linked to red meat (locked) and sodium, with a staged removal of sodium and a staged addition of vegetables.
const BEEF: Row = {
	id: 'ti-beef',
	name: 'Beef',
	note: 'beef note',
	linkedRecommendationIds: ['rec-red-meat', 'rec-sodium'],
	stagedRecommendationIds: ['rec-sodium', 'rec-vegetables'],
};

function renderGrid(onToggle = vi.fn(), lockedRecommendationIds?: (row: Row) => string[]) {
	render(
		<RecommendationLinkGrid
			columns={COLUMNS}
			rows={[BEEF]}
			nameHeader="Trigger Ingredient"
			renderName={(row) => <span>{row.name}</span>}
			leadingColumns={[{ key: 'note', header: 'Note', render: (row) => row.note }]}
			trailingColumns={[{ key: 'actions', header: 'Actions', render: (row) => `actions of ${row.name}` }]}
			toggleLabel="Toggle"
			lockedRecommendationIds={lockedRecommendationIds}
			lockedTitle="assigned by a rule"
			onToggle={onToggle}
		/>,
	);
	return onToggle;
}

describe('RecommendationLinkGrid', () => {
	it('marks the encouraged column headers with a plus and the limited ones with a minus', () => {
		renderGrid();

		expect(screen.getByText('+ vegetables').getAttribute('title')).toBe('vegetables: ENCOURAGED');
		expect(screen.getByText('- red meat').getAttribute('title')).toBe('red meat: LIMITED');
	});

	it('renders the name, the leading and the trailing columns of each row', () => {
		renderGrid();

		expect(screen.getByText('Trigger Ingredient')).not.toBeNull();
		expect(screen.getByText('Beef')).not.toBeNull();
		expect(screen.getByText('Note')).not.toBeNull();
		expect(screen.getByText('beef note')).not.toBeNull();
		expect(screen.getByText('actions of Beef')).not.toBeNull();
	});

	it('shows the effective presence of each cell and marks the pending changes', () => {
		renderGrid();

		const redMeat = screen.getByLabelText('Toggle Beef / red meat');
		expect(redMeat.getAttribute('aria-pressed')).toBe('true');
		expect(redMeat.className).not.toContain('bg-');
		const sodium = screen.getByLabelText('Toggle Beef / sodium');
		expect(sodium.getAttribute('aria-pressed')).toBe('false');
		expect(sodium.className).toContain('bg-error');
		const vegetables = screen.getByLabelText('Toggle Beef / vegetables');
		expect(vegetables.getAttribute('aria-pressed')).toBe('true');
		expect(vegetables.className).toContain('bg-success');
		expect(vegetables.getAttribute('title')).toBe('Beef: vegetables');
	});

	it('toggles a cell to the opposite of its effective presence', () => {
		const onToggle = renderGrid();

		fireEvent.click(screen.getByLabelText('Toggle Beef / red meat'));
		fireEvent.click(screen.getByLabelText('Toggle Beef / sodium'));

		expect(onToggle).toHaveBeenNthCalledWith(1, BEEF, 'rec-red-meat', false);
		expect(onToggle).toHaveBeenNthCalledWith(2, BEEF, 'rec-sodium', true);
	});

	it('shows a locked cell as present and does not toggle it', () => {
		const onToggle = renderGrid(vi.fn(), () => ['rec-red-meat', 'rec-vegetables']);

		const redMeat = screen.getByLabelText('Toggle Beef / red meat') as HTMLButtonElement;
		expect(redMeat.getAttribute('aria-pressed')).toBe('true');
		expect(redMeat.disabled).toBe(true);
		expect(redMeat.getAttribute('title')).toBe('Beef: red meat (assigned by a rule)');
		fireEvent.click(redMeat);

		expect(onToggle).not.toHaveBeenCalled();
		expect((screen.getByLabelText('Toggle Beef / sodium') as HTMLButtonElement).disabled).toBe(false);
	});
});
