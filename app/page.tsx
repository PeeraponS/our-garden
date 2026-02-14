import { generateGarden, generateEmojis } from '@/lib/garden';
import { TEXT_SETS, ALWAYS_EMOJIS, ROTATING_EMOJIS } from '@/lib/gardenConfig';
import Garden from './components/Garden';

export const dynamic = 'force-dynamic';

const START_DATE = new Date('2017-10-27');

export default function Home() {
    const today = new Date();
    const daysSinceStart = Math.floor(
        (today.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24),
    );
    const count = Math.max(0, daysSinceStart);
    const flowers = generateGarden(count, TEXT_SETS);
    const emojis = generateEmojis(ALWAYS_EMOJIS, ROTATING_EMOJIS);

    return <Garden flowers={flowers} total={count} emojis={emojis} />;
}
