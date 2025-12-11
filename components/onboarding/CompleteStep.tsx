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
    router.push('/garden/public-board');
    onEnterGarden();
  };

  return (
    <div className="space-y-6 text-center">
      <div 
        className={`text-8xl mb-6 transition-all duration-2000 ${
          showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        🌅
      </div>
      
      <h2 
        className={`text-3xl font-bold mb-4 transition-all duration-1000 delay-300 ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        Your Garden is alive
      </h2>
      
      <p 
        className={`text-lg text-gray-600 dark:text-gray-400 mb-8 transition-all duration-1000 delay-500 ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        Explore, grow, connect.
      </p>

      <div 
        className={`transition-all duration-1000 delay-700 ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <button
          onClick={handleEnterGarden}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-lg shadow-lg hover:shadow-xl"
        >
          Enter Garden →
        </button>
      </div>

      {/* Progress indicator */}
      <div className="mt-8">
        <div className="inline-block px-4 py-2 bg-white/50 dark:bg-gray-800/50 rounded-full text-sm">
          Profile 67% complete
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Missing: Availability, Bio, Links (optional)
        </p>
      </div>
    </div>
  );
}
