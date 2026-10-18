import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TypeOfRecommendationIcon } from './TypeOfRecommendationIcon';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TypeOfRecommendationIcon', () => {
	it('shows a green thumbs-up labelled encouraged for ENCOURAGED', () => {
		render(<TypeOfRecommendationIcon typeOfRecommendation="ENCOURAGED" />);

		const icon = screen.getByLabelText('recommendations.typeOfRecommendationEncouraged');
		expect(icon.getAttribute('title')).toBe('recommendations.typeOfRecommendationEncouraged');
		expect(icon.querySelector('svg')?.getAttribute('class')).toContain('text-success');
	});

	it('shows a red thumbs-down labelled limited for LIMITED', () => {
		render(<TypeOfRecommendationIcon typeOfRecommendation="LIMITED" />);

		const icon = screen.getByLabelText('recommendations.typeOfRecommendationLimited');
		expect(icon.getAttribute('title')).toBe('recommendations.typeOfRecommendationLimited');
		expect(icon.querySelector('svg')?.getAttribute('class')).toContain('text-error');
	});

	it('leaves the title out when asked to, keeping the accessible label', () => {
		render(<TypeOfRecommendationIcon typeOfRecommendation="ENCOURAGED" withTitle={false} />);

		const icon = screen.getByLabelText('recommendations.typeOfRecommendationEncouraged');
		expect(icon.getAttribute('title')).toBeNull();
	});
});
