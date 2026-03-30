/**
 * Completion Step Component
 *
 * Dawn moment - onboarding complete!
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CompleteStepProps {
  onEnterGarden: () => void;
}

export function CompleteStep({ onEnterGarden }: CompleteStepProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Trigger dawn animation
    setTimeout(() => setShowAnimation(true), 100);
  }, []);

  const handleEnterGarden = () => {
    router.push('/me');
    onEnterGarden();
  };

  return (
    <div className="animate-fade-in space-y-8 text-center">
      <div
        className={`duration-2000 mb-6 text-8xl transition-all ${
          showAnimation ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        style={{
          filter: showAnimation
            ? 'drop-shadow(0 0 30px rgba(255, 200, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 200, 0, 0.4))'
            : 'none',
        }}
      >
        🌅
      </div>

      <h2
        className={`mb-4 text-4xl font-bold transition-all delay-300 duration-1000 md:text-5xl ${
          showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        } text-white drop-shadow-lg dark:text-white`}
        style={{
          textShadow: showAnimation
            ? '0 0 20px rgba(255, 200, 0, 0.5), 0 0 40px rgba(255, 200, 0, 0.3)'
            : 'none',
        }}
      >
        Your Garden is alive
      </h2>

      <p
        className={`mb-8 text-lg transition-all delay-500 duration-1000 ${
          showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        } text-gray-200 drop-shadow-md dark:text-gray-300`}
        style={{
          textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        Explore, grow, connect.
      </p>

      <div
        className={`transition-all delay-700 duration-1000 ${
          showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <button
          onClick={handleEnterGarden}
          className="rounded-xl bg-green-600 px-8 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-700 hover:shadow-xl"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
