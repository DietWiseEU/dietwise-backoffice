import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	type RecommendationLinkColumn,
	type RecommendationLinkRow,
	RecommendationLinkGrid,
} from './RecommendationLinkGrid';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

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

function renderGrid(onToggle = vi.fn(), lockedRecommendationIds?: (row: Row) => string[], columns = COLUMNS) {
	render(
		<RecommendationLinkGrid
			columns={columns}
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
	it('marks the encouraged column headers with a thumbs-up and the limited ones with a thumbs-down', () => {
		renderGrid();

		const vegetables = screen.getByRole('columnheader', { name: /vegetables/ });
		expect(vegetables.getAttribute('title')).toBe('vegetables: ENCOURAGED');
		const vegetablesIcon = within(vegetables).getByLabelText('recommendations.typeOfRecommendationEncouraged');
		expect(vegetablesIcon.getAttribute('title')).toBeNull();
		const redMeat = screen.getByRole('columnheader', { name: /red meat/ });
		expect(redMeat.getAttribute('title')).toBe('red meat: LIMITED');
		expect(within(redMeat).getByLabelText('recommendations.typeOfRecommendationLimited')).not.toBeNull();
	});

	it('abbreviates the long components for scoring in the header, keeping the full name in the title', () => {
		renderGrid(vi.fn(), undefined, [
			{
				id: 'rec-omega-6',
				componentForScoring: 'omega-6 polyunsaturated fatty acids',
				typeOfRecommendation: 'LIMITED',
			},
			{
				id: 'rec-omega-3',
				componentForScoring: 'seafood omega-3 fatty acids',
				typeOfRecommendation: 'ENCOURAGED',
			},
			{ id: 'rec-sugar', componentForScoring: 'sugar-sweetened beverages', typeOfRecommendation: 'LIMITED' },
		]);

		expect(screen.getByText('omega-6').closest('th')?.getAttribute('title')).toBe(
			'omega-6 polyunsaturated fatty acids: LIMITED',
		);
		expect(screen.getByText('omega-3').closest('th')?.getAttribute('title')).toBe(
			'seafood omega-3 fatty acids: ENCOURAGED',
		);
		expect(screen.getByText('sugar beverages').closest('th')?.getAttribute('title')).toBe(
			'sugar-sweetened beverages: LIMITED',
		);
		expect(screen.getByLabelText('Toggle Beef / omega-6 polyunsaturated fatty acids')).not.toBeNull();
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
