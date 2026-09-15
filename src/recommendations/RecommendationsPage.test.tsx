import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { MAX_LENGTHS } from '@/api/fieldLimits';
import {
	type Recommendation,
	type RecommendationTranslationDetails,
	fetchRecommendations,
	fetchRecommendationTranslations,
	revertMaster,
	revertRecommendationTranslation,
	stageMaster,
	stageRecommendationTranslation,
} from '@/recommendations/recommendations';
import { RecommendationsPage } from './RecommendationsPage';

vi.mock('@/recommendations/recommendations', () => ({
	fetchRecommendations: vi.fn(),
	stageMaster: vi.fn(),
	revertMaster: vi.fn(),
	fetchRecommendationTranslations: vi.fn(),
	stageRecommendationTranslation: vi.fn(),
	revertRecommendationTranslation: vi.fn(),
	LANGUAGES: ['EL', 'LT', 'NL'],
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const fetchRecommendationsMock = vi.mocked(fetchRecommendations);
const stageMasterMock = vi.mocked(stageMaster);
const revertMasterMock = vi.mocked(revertMaster);
const fetchRecommendationTranslationsMock = vi.mocked(fetchRecommendationTranslations);
const stageRecommendationTranslationMock = vi.mocked(stageRecommendationTranslation);
const revertRecommendationTranslationMock = vi.mocked(revertRecommendationTranslation);

const TRANSLATIONS: Record<'EL' | 'LT' | 'NL', RecommendationTranslationDetails> = {
	EL: {
		name: 'Επεξεργασμένο κρέας',
		componentForScoring: 'επεξεργασμένο κρέας',
		explanationForLlm: 'Λιγότερο.',
		humanFriendlyDisplay: 'Εμφάνιση.',
		version: 2,
	},
	LT: { name: null, componentForScoring: null, explanationForLlm: null, humanFriendlyDisplay: null, version: 0 },
	NL: { name: null, componentForScoring: null, explanationForLlm: null, humanFriendlyDisplay: null, version: 0 },
};

const LIMITED_RECOMMENDATION: Recommendation = {
	id: '1',
	name: 'Decrease processed meat',
	componentForScoring: 'processed meat',
	typeOfRecommendation: 'LIMITED',
	explanationForLlm: 'Cured and smoked red meat.',
	explanationChanged: false,
	humanFriendlyDisplay: 'Processed meat',
	humanFriendlyDisplayChanged: false,
	version: 0,
	translations: { EL: 'PRESENT', LT: 'MISSING', NL: 'STAGED' },
};

const ENCOURAGED_RECOMMENDATION: Recommendation = {
	id: '2',
	name: 'Increase legumes',
	componentForScoring: 'legumes',
	typeOfRecommendation: 'ENCOURAGED',
	explanationForLlm: null,
	explanationChanged: false,
	humanFriendlyDisplay: null,
	humanFriendlyDisplayChanged: false,
	version: 0,
	translations: { EL: 'MISSING', LT: 'MISSING', NL: 'MISSING' },
};

const CHANGED_RECOMMENDATION: Recommendation = {
	...LIMITED_RECOMMENDATION,
	explanationForLlm: 'Staged explanation.',
	explanationChanged: true,
	version: 3,
};

describe('RecommendationsPage', () => {
	beforeEach(() => {
		fetchRecommendationsMock.mockReset();
		stageMasterMock.mockReset();
		revertMasterMock.mockReset();
		fetchRecommendationTranslationsMock.mockReset();
		stageRecommendationTranslationMock.mockReset();
		revertRecommendationTranslationMock.mockReset();
	});

	it('renders one row per recommendation with its name, component, explanation and human friendly display', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION, ENCOURAGED_RECOMMENDATION]);

		render(<RecommendationsPage />);

		expect(await screen.findByText('Decrease processed meat')).not.toBeNull();
		expect(screen.getByText('processed meat')).not.toBeNull();
		expect(screen.getByDisplayValue('Cured and smoked red meat.')).not.toBeNull();
		expect(screen.getByDisplayValue('Processed meat')).not.toBeNull();
		expect(screen.getByText('Increase legumes')).not.toBeNull();
		expect(screen.getByText('legumes')).not.toBeNull();
	});

	it('shows a green thumbs-up for ENCOURAGED and a red thumbs-down for LIMITED', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION, ENCOURAGED_RECOMMENDATION]);

		render(<RecommendationsPage />);

		expect(await screen.findByLabelText('recommendations.typeOfRecommendationLimited')).not.toBeNull();
		expect(screen.getByLabelText('recommendations.typeOfRecommendationEncouraged')).not.toBeNull();
	});

	it('shows an empty editable explanation and human friendly display for a recommendation without them', async () => {
		fetchRecommendationsMock.mockResolvedValue([ENCOURAGED_RECOMMENDATION]);

		render(<RecommendationsPage />);

		const explanation = (await screen.findByLabelText('recommendations.explanationEditLabel')) as HTMLInputElement;
		expect(explanation.value).toBe('');
		const display = screen.getByLabelText('recommendations.humanFriendlyDisplayEditLabel') as HTMLInputElement;
		expect(display.value).toBe('');
	});

	it('reports an over-long explanation on blur and does not stage it, keeping the text to be shortened', async () => {
		fetchRecommendationsMock.mockResolvedValue([ENCOURAGED_RECOMMENDATION]);
		const tooLong = 'e'.repeat(MAX_LENGTHS.recommendationExplanation + 1);

		render(<RecommendationsPage />);

		const explanation = (await screen.findByLabelText('recommendations.explanationEditLabel')) as HTMLInputElement;
		fireEvent.change(explanation, { target: { value: tooLong } });
		fireEvent.blur(explanation);

		expect(screen.getByText('validation.tooLong')).not.toBeNull();
		expect(stageMasterMock).not.toHaveBeenCalled();
		expect(explanation.value).toBe(tooLong);
		expect(explanation.className).toContain('border-error');
	});

	it('marks an over-long explanation as an error rather than as a pending change', async () => {
		fetchRecommendationsMock.mockResolvedValue([CHANGED_RECOMMENDATION]);

		render(<RecommendationsPage />);

		const explanation = (await screen.findByLabelText('recommendations.explanationEditLabel')) as HTMLInputElement;
		expect(explanation.className).toContain('border-warning');

		fireEvent.change(explanation, {
			target: { value: 'e'.repeat(MAX_LENGTHS.recommendationExplanation + 1) },
		});

		// Both border colours are utilities of the same weight, so the two must never be emitted together.
		expect(explanation.className).toContain('border-error');
		expect(explanation.className).not.toContain('border-warning');
	});

	it('reports an over-long human friendly display on blur and does not stage it', async () => {
		fetchRecommendationsMock.mockResolvedValue([ENCOURAGED_RECOMMENDATION]);

		render(<RecommendationsPage />);

		await screen.findByLabelText('recommendations.explanationEditLabel');
		const display = screen.getByLabelText('recommendations.humanFriendlyDisplayEditLabel') as HTMLInputElement;
		fireEvent.change(display, {
			target: { value: 'd'.repeat(MAX_LENGTHS.recommendationHumanFriendlyDisplay + 1) },
		});
		fireEvent.blur(display);

		expect(screen.getByText('validation.tooLong')).not.toBeNull();
		expect(stageMasterMock).not.toHaveBeenCalled();
		expect(display.className).toContain('border-error');
		expect(
			(screen.getByLabelText('recommendations.explanationEditLabel') as HTMLInputElement).className,
		).not.toContain('border-error');
	});

	it('renders a translation chip per language', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION]);

		render(<RecommendationsPage />);

		await screen.findByText('Decrease processed meat');
		expect(screen.getByText('EL')).not.toBeNull();
		expect(screen.getByText('LT')).not.toBeNull();
		expect(screen.getByText('NL')).not.toBeNull();
	});

	it('stages an edited explanation with the current display against its base version, then reloads and highlights it', async () => {
		fetchRecommendationsMock
			.mockResolvedValueOnce([LIMITED_RECOMMENDATION])
			.mockResolvedValueOnce([CHANGED_RECOMMENDATION]);
		stageMasterMock.mockResolvedValue(undefined);

		render(<RecommendationsPage />);

		const input = (await screen.findByLabelText('recommendations.explanationEditLabel')) as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'Processed and cured meats.' } });
		fireEvent.blur(input);

		await waitFor(() =>
			expect(stageMasterMock).toHaveBeenCalledWith('1', 'Processed and cured meats.', 'Processed meat', 0),
		);
		await waitFor(() =>
			expect(
				(screen.getByLabelText('recommendations.explanationEditLabel') as HTMLInputElement).className,
			).toContain('bg-warning'),
		);
	});

	it('stages an edited human friendly display with the current explanation against its base version', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION]);
		stageMasterMock.mockResolvedValue(undefined);

		render(<RecommendationsPage />);

		const input = (await screen.findByLabelText(
			'recommendations.humanFriendlyDisplayEditLabel',
		)) as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'Cured meats' } });
		fireEvent.blur(input);

		await waitFor(() =>
			expect(stageMasterMock).toHaveBeenCalledWith('1', 'Cured and smoked red meat.', 'Cured meats', 0),
		);
	});

	it('offers revert for a changed row and reverts both master fields against the staged version', async () => {
		fetchRecommendationsMock
			.mockResolvedValueOnce([CHANGED_RECOMMENDATION])
			.mockResolvedValueOnce([LIMITED_RECOMMENDATION]);
		revertMasterMock.mockResolvedValue(undefined);

		render(<RecommendationsPage />);

		fireEvent.click(await screen.findByText('recommendations.revert'));

		await waitFor(() => expect(revertMasterMock).toHaveBeenCalledWith('1', 3));
	});

	it('warns and refreshes the grid when a master save is rejected as stale', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION]);
		stageMasterMock.mockRejectedValue(new ApiError(409, 'conflict'));

		render(<RecommendationsPage />);

		const input = (await screen.findByLabelText('recommendations.explanationEditLabel')) as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'Changed.' } });
		fireEvent.blur(input);

		expect(await screen.findByText('recommendations.staleReload')).not.toBeNull();
		await waitFor(() => expect(fetchRecommendationsMock).toHaveBeenCalledTimes(2));
	});

	it('shows an error message when loading fails', async () => {
		fetchRecommendationsMock.mockRejectedValue(new Error('boom'));

		render(<RecommendationsPage />);

		expect(await screen.findByText('recommendations.loadError')).not.toBeNull();
	});

	it('opens the translations dialog from the chips and stages a language against its version', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION]);
		fetchRecommendationTranslationsMock.mockResolvedValue(TRANSLATIONS);
		stageRecommendationTranslationMock.mockResolvedValue(undefined);

		render(<RecommendationsPage />);

		fireEvent.click(await screen.findByLabelText('recommendations.editTranslations'));

		const greekName = (await screen.findByLabelText('EL recommendations.columnName')) as HTMLInputElement;
		await waitFor(() => expect(greekName.value).toBe('Επεξεργασμένο κρέας'));
		fireEvent.change(greekName, { target: { value: 'Αλλαγή' } });
		fireEvent.click(screen.getAllByText('recommendations.translationSave')[0]);

		await waitFor(() =>
			expect(stageRecommendationTranslationMock).toHaveBeenCalledWith(
				'1',
				'EL',
				'Αλλαγή',
				'επεξεργασμένο κρέας',
				'Λιγότερο.',
				'Εμφάνιση.',
				2,
			),
		);
	});

	it('reverts a staged language translation against its version', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION]);
		fetchRecommendationTranslationsMock.mockResolvedValue(TRANSLATIONS);
		revertRecommendationTranslationMock.mockResolvedValue(undefined);

		render(<RecommendationsPage />);

		fireEvent.click(await screen.findByLabelText('recommendations.editTranslations'));
		fireEvent.click(await screen.findByText('recommendations.translationRevert'));

		await waitFor(() => expect(revertRecommendationTranslationMock).toHaveBeenCalledWith('1', 'EL', 2));
	});

	it('warns and refreshes the grid when staging a translation is rejected as stale', async () => {
		fetchRecommendationsMock.mockResolvedValue([LIMITED_RECOMMENDATION]);
		fetchRecommendationTranslationsMock.mockResolvedValue(TRANSLATIONS);
		stageRecommendationTranslationMock.mockRejectedValue(new ApiError(409, 'conflict'));

		render(<RecommendationsPage />);

		fireEvent.click(await screen.findByLabelText('recommendations.editTranslations'));
		const greekName = (await screen.findByLabelText('EL recommendations.columnName')) as HTMLInputElement;
		await waitFor(() => expect(greekName.value).toBe('Επεξεργασμένο κρέας'));
		fireEvent.change(greekName, { target: { value: 'Αλλαγή' } });
		fireEvent.click(screen.getAllByText('recommendations.translationSave')[0]);

		expect(await screen.findByText('recommendations.staleReload')).not.toBeNull();
		await waitFor(() => expect(fetchRecommendationsMock).toHaveBeenCalledTimes(2));
	});
});
