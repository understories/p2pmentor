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
    <div className="space-y-8 text-center animate-fade-in">
      <div 
        className={`text-8xl mb-6 transition-all duration-2000 ${
          showAnimation ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
        style={{
          filter: showAnimation ? 'drop-shadow(0 0 30px rgba(255, 200, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 200, 0, 0.4))' : 'none',
        }}
      >
        🌅
      </div>
      
      <h2 
        className={`text-4xl md:text-5xl font-bold mb-4 transition-all duration-1000 delay-300 ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        } text-white dark:text-white drop-shadow-lg`}
        style={{
          textShadow: showAnimation ? '0 0 20px rgba(255, 200, 0, 0.5), 0 0 40px rgba(255, 200, 0, 0.3)' : 'none',
        }}
      >
        Your Garden is alive
      </h2>
      
      <p 
        className={`text-lg mb-8 transition-all duration-1000 delay-500 ${
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        } text-gray-200 dark:text-gray-300 drop-shadow-md`}
        style={{
          textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        }}
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
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all duration-200 font-medium text-lg shadow-lg hover:shadow-xl"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
