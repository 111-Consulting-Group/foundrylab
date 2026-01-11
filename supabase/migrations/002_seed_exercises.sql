-- Seed default exercises for Foundry Lab app
-- These are common exercises for hybrid athletes (Strength + Conditioning)

-- ============================================
-- Strength Exercises - Compound Movements
-- ============================================

INSERT INTO exercises (name, modality, primary_metric, muscle_group, equipment, instructions, is_custom) VALUES
-- Lower Body Compounds
('Barbell Back Squat', 'Strength', 'Weight', 'Legs', 'Barbell', 'Stand with feet shoulder-width apart. Bar on upper back. Squat until thighs parallel. Drive up through heels.', FALSE),
('Barbell Front Squat', 'Strength', 'Weight', 'Legs', 'Barbell', 'Bar on front delts with elbows high. Squat with upright torso. Drive up through heels.', FALSE),
('Romanian Deadlift', 'Strength', 'Weight', 'Hamstrings', 'Barbell', 'Hinge at hips with slight knee bend. Lower bar along legs. Feel hamstring stretch. Drive hips forward.', FALSE),
('Conventional Deadlift', 'Strength', 'Weight', 'Back', 'Barbell', 'Bar over mid-foot. Hinge and grip. Drive through floor keeping bar close. Lock out hips and knees.', FALSE),
('Sumo Deadlift', 'Strength', 'Weight', 'Legs', 'Barbell', 'Wide stance, toes out. Grip inside knees. Drive through floor spreading the floor with feet.', FALSE),
('Barbell Hip Thrust', 'Strength', 'Weight', 'Glutes', 'Barbell', 'Upper back on bench, bar on hips. Drive hips up squeezing glutes. Control the descent.', FALSE),
('Leg Press', 'Strength', 'Weight', 'Legs', 'Machine', 'Feet shoulder-width on platform. Lower until 90 degrees. Press through whole foot.', FALSE),
('Hack Squat', 'Strength', 'Weight', 'Legs', 'Machine', 'Shoulders under pads, feet forward. Squat deep. Drive up through heels.', FALSE),

-- Upper Body Push
('Barbell Bench Press', 'Strength', 'Weight', 'Chest', 'Barbell', 'Grip slightly wider than shoulders. Lower bar to chest. Press up over shoulders.', FALSE),
('Incline Bench Press', 'Strength', 'Weight', 'Chest', 'Barbell', 'Bench at 30-45 degrees. Lower to upper chest. Press up maintaining elbow path.', FALSE),
('Dumbbell Bench Press', 'Strength', 'Weight', 'Chest', 'Dumbbells', 'Dumbbells at chest level. Press up bringing together at top. Control descent.', FALSE),
('Overhead Press', 'Strength', 'Weight', 'Shoulders', 'Barbell', 'Bar at front rack. Press overhead keeping core tight. Lock out arms overhead.', FALSE),
('Dumbbell Shoulder Press', 'Strength', 'Weight', 'Shoulders', 'Dumbbells', 'Dumbbells at shoulder height. Press overhead. Control descent.', FALSE),
('Close Grip Bench Press', 'Strength', 'Weight', 'Triceps', 'Barbell', 'Hands shoulder-width. Lower bar to lower chest. Press up focusing on triceps.', FALSE),
('Dips', 'Strength', 'Weight', 'Chest', 'Bodyweight', 'Grip parallel bars. Lower until upper arms parallel. Press up to lockout.', FALSE),

-- Upper Body Pull
('Barbell Row', 'Strength', 'Weight', 'Back', 'Barbell', 'Hinge at hips, back flat. Pull bar to lower chest. Squeeze shoulder blades.', FALSE),
('Pendlay Row', 'Strength', 'Weight', 'Back', 'Barbell', 'Bar on floor each rep. Explosive pull to lower chest. Control return to floor.', FALSE),
('Dumbbell Row', 'Strength', 'Weight', 'Back', 'Dumbbells', 'One arm on bench for support. Row dumbbell to hip. Squeeze at top.', FALSE),
('Pull-Up', 'Strength', 'Weight', 'Back', 'Bodyweight', 'Grip wider than shoulders. Pull chin over bar. Control descent fully.', FALSE),
('Chin-Up', 'Strength', 'Weight', 'Back', 'Bodyweight', 'Underhand grip shoulder-width. Pull chin over bar. Full range of motion.', FALSE),
('Supinated Pull-Up', 'Strength', 'Weight', 'Back', 'Bodyweight', 'Underhand grip (supinated), palms facing you. Pull chin over bar. Targets biceps and lats more than pronated grip.', FALSE),
('Lat Pulldown', 'Strength', 'Weight', 'Back', 'Cable', 'Wide grip, pull to upper chest. Squeeze lats at bottom. Control return.', FALSE),
('Cable Row', 'Strength', 'Weight', 'Back', 'Cable', 'Sit upright, pull handle to lower chest. Squeeze shoulder blades. Slow return.', FALSE),
('Face Pull', 'Strength', 'Weight', 'Shoulders', 'Cable', 'Pull rope to face with elbows high. Squeeze rear delts. Control return.', FALSE),

-- Isolation Exercises
('Leg Extension', 'Strength', 'Weight', 'Quads', 'Machine', 'Extend legs fully. Squeeze quads at top. Slow controlled lowering.', FALSE),
('Leg Curl', 'Strength', 'Weight', 'Hamstrings', 'Machine', 'Curl heels toward glutes. Squeeze hamstrings at top. Slow eccentric.', FALSE),
('Calf Raise', 'Strength', 'Weight', 'Calves', 'Machine', 'Rise onto toes fully. Pause at top. Full stretch at bottom.', FALSE),
('Lateral Raise', 'Strength', 'Weight', 'Shoulders', 'Dumbbells', 'Raise arms to sides until parallel. Control descent. Slight elbow bend.', FALSE),
('Rear Delt Fly', 'Strength', 'Weight', 'Shoulders', 'Dumbbells', 'Hinged position, fly arms out and back. Squeeze rear delts. Control.', FALSE),
('Bicep Curl', 'Strength', 'Weight', 'Biceps', 'Dumbbells', 'Curl weights with controlled motion. Squeeze at top. Full extension.', FALSE),
('Hammer Curl', 'Strength', 'Weight', 'Biceps', 'Dumbbells', 'Neutral grip, curl weights. Targets brachialis. Full range of motion.', FALSE),
('Tricep Pushdown', 'Strength', 'Weight', 'Triceps', 'Cable', 'Elbows pinned at sides. Push down to full lockout. Slow return.', FALSE),
('Skull Crushers', 'Strength', 'Weight', 'Triceps', 'Barbell', 'Lower bar to forehead. Extend arms. Keep elbows stationary.', FALSE),
('Cable Fly', 'Strength', 'Weight', 'Chest', 'Cable', 'Bring handles together in arc motion. Squeeze chest. Control opening.', FALSE),

-- ============================================
-- Cardio Exercises
-- ============================================

('Assault Bike', 'Cardio', 'Watts', 'Cardio', 'Assault Bike', 'Full body cardio using arms and legs. Maintain consistent wattage for Zone 2 or intervals.', FALSE),
('Rowing Machine', 'Cardio', 'Watts', 'Cardio', 'Rower', 'Drive with legs, lean back, pull to chest. Smooth recovery. Watch your split time.', FALSE),
('Ski Erg', 'Cardio', 'Watts', 'Cardio', 'Ski Erg', 'Pull handles down using lats and core. Hip hinge. Maintain rhythm.', FALSE),
('Treadmill Run', 'Cardio', 'Pace', 'Cardio', 'Treadmill', 'Running on treadmill. Adjust speed and incline as needed.', FALSE),
('Outdoor Run', 'Cardio', 'Pace', 'Cardio', 'None', 'Running outdoors. Use GPS to track pace and distance.', FALSE),
('Stationary Bike', 'Cardio', 'Watts', 'Cardio', 'Bike', 'Cycling on stationary bike. Maintain cadence and power output.', FALSE),
('Stair Climber', 'Cardio', 'Distance', 'Cardio', 'Stair Climber', 'Step climbing for cardio. Maintain consistent pace.', FALSE),
('Elliptical', 'Cardio', 'Distance', 'Cardio', 'Elliptical', 'Low impact cardio. Forward or reverse motion.', FALSE),

-- ============================================
-- Hybrid Exercises (Both Strength & Cardio)
-- ============================================

('Kettlebell Swing', 'Hybrid', 'Weight', 'Glutes', 'Kettlebell', 'Hip hinge, swing kettlebell to shoulder height. Squeeze glutes at top.', FALSE),
('Thrusters', 'Hybrid', 'Weight', 'Full Body', 'Barbell', 'Front squat into overhead press in one fluid motion. High heart rate.', FALSE),
('Clean and Jerk', 'Hybrid', 'Weight', 'Full Body', 'Barbell', 'Clean to shoulders, dip and drive overhead. Full body power movement.', FALSE),
('Snatch', 'Hybrid', 'Weight', 'Full Body', 'Barbell', 'Floor to overhead in one motion. Technical lift requiring mobility.', FALSE),
('Power Clean', 'Hybrid', 'Weight', 'Full Body', 'Barbell', 'Explosive pull from floor, catch at shoulders. Power development.', FALSE),
('Box Jump', 'Hybrid', 'Distance', 'Legs', 'Box', 'Explosive jump onto box. Step down. Reset between reps.', FALSE),
('Burpees', 'Hybrid', 'Distance', 'Full Body', 'Bodyweight', 'Drop to floor, push up, jump up. High conditioning demand.', FALSE),
('Wall Ball', 'Hybrid', 'Weight', 'Full Body', 'Medicine Ball', 'Squat with ball, drive up and throw to target. Catch and repeat.', FALSE),
('Battle Ropes', 'Hybrid', 'Distance', 'Full Body', 'Battle Ropes', 'Alternating or simultaneous waves. High intensity conditioning.', FALSE),
('Sled Push', 'Hybrid', 'Distance', 'Legs', 'Sled', 'Drive sled forward with powerful leg drive. Cardiovascular and strength.', FALSE),
('Sled Pull', 'Hybrid', 'Distance', 'Back', 'Sled', 'Pull sled toward you using rope. Full body engagement.', FALSE),
('Farmers Carry', 'Hybrid', 'Distance', 'Full Body', 'Dumbbells', 'Walk with heavy weights in each hand. Core stability and grip strength.', FALSE);

-- Add commonly used exercise variations
INSERT INTO exercises (name, modality, primary_metric, muscle_group, equipment, instructions, is_custom) VALUES
('Bulgarian Split Squat', 'Strength', 'Weight', 'Legs', 'Dumbbells', 'Rear foot elevated, lunge down. Drive through front heel. Balance focus.', FALSE),
('Walking Lunges', 'Strength', 'Weight', 'Legs', 'Dumbbells', 'Step forward into lunge. Drive up and step through. Alternate legs.', FALSE),
('Goblet Squat', 'Strength', 'Weight', 'Legs', 'Kettlebell', 'Hold weight at chest. Squat between heels. Upright torso throughout.', FALSE),
('Deficit Deadlift', 'Strength', 'Weight', 'Back', 'Barbell', 'Stand on platform for increased range of motion. Maintain flat back.', FALSE),
('Pause Squat', 'Strength', 'Weight', 'Legs', 'Barbell', 'Pause at bottom of squat for 2-3 seconds. Build strength out of hole.', FALSE),
('Spoto Press', 'Strength', 'Weight', 'Chest', 'Barbell', 'Pause 1-2 inches off chest. Build strength at sticking point.', FALSE),
('Arnold Press', 'Strength', 'Weight', 'Shoulders', 'Dumbbells', 'Rotate from palms facing you to away during press. Full shoulder engagement.', FALSE),
('Preacher Curl', 'Strength', 'Weight', 'Biceps', 'Barbell', 'Isolate biceps on preacher bench. Full range of motion. Control eccentric.', FALSE),
('Overhead Tricep Extension', 'Strength', 'Weight', 'Triceps', 'Dumbbells', 'Extend weight overhead. Lower behind head. Full stretch and extension.', FALSE),
('Shrugs', 'Strength', 'Weight', 'Traps', 'Barbell', 'Shrug shoulders straight up. Squeeze at top. No rolling motion.', FALSE);
