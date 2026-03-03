import SavingsJarTracker from "./SavingsJarTracker";
import WeightJourneyTracker from "./WeightJourneyTracker";
import HabitGridTracker from "./HabitGridTracker";
import PlantGrowthTracker from "./PlantGrowthTracker";
import BookshelfTracker from "./BookshelfTracker";
import MoonPhaseTracker from "./MoonPhaseTracker";
import RocketTracker from "./RocketTracker";
import WaterBottleTracker from "./WaterBottleTracker";
import SkillTreeTracker from "./SkillTreeTracker";
import StreakFlameTracker from "./StreakFlameTracker";

const GoalTrackerRenderer = ({ goal }) => {
    const trackerMap = {
        savings: (
            <SavingsJarTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        weight: (
            <WeightJourneyTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        training: (
            <HabitGridTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        tasks: (
            <PlantGrowthTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        reading: (
            <BookshelfTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        meditation: (
            <MoonPhaseTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        revenue: (
            <RocketTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        hydration: (
            <WaterBottleTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        learning: (
            <SkillTreeTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
        streak: (
            <StreakFlameTracker
                current={goal.current}
                target={goal.target}
                name={goal.name}
            />
        ),
    };

    return <>{trackerMap[goal.type]}</>;
};

export default GoalTrackerRenderer;