import { useTranslation } from 'react-i18next';
import { FiThumbsDown, FiThumbsUp } from 'react-icons/fi';

/** Tells apart the Recommendations whose component raises a recipe's score (a green thumbs-up, ENCOURAGED) from those
 * whose component lowers it (a red thumbs-down, LIMITED). */
export function TypeOfRecommendationIcon({
	typeOfRecommendation,
	withTitle = true,
}: {
	typeOfRecommendation: 'ENCOURAGED' | 'LIMITED';
	/** Whether hovering the icon explains it; leave it out where an enclosing element's title already does. */
	withTitle?: boolean;
}) {
	const { t } = useTranslation();
	const encouraged = typeOfRecommendation === 'ENCOURAGED';
	const label = encouraged
		? t('recommendations.typeOfRecommendationEncouraged')
		: t('recommendations.typeOfRecommendationLimited');
	return (
		<span role="img" aria-label={label} title={withTitle ? label : undefined} className="inline-flex text-lg">
			{encouraged ? (
				<FiThumbsUp className="text-success" aria-hidden />
			) : (
				<FiThumbsDown className="text-error" aria-hidden />
			)}
		</span>
	);
}
