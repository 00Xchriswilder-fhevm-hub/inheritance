import React, { useState, useEffect } from 'react';

interface Flashcard {
  question: string;
  answer: string;
}

interface FlashcardFAQProps {
  isOpen: boolean;
  onClose: () => void;
}

const FlashcardFAQ: React.FC<FlashcardFAQProps> = ({ isOpen, onClose }) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load flashcards from CSV
    const loadFlashcards = async () => {
      try {
        const response = await fetch('/flashcards.csv');
        const text = await response.text();
        
        // Parse CSV - handle quoted fields properly
        const lines = text.split('\n').filter(line => line.trim());
        const parsed: Flashcard[] = [];
        
        for (const line of lines) {
          // More robust CSV parsing that handles quoted commas
          let question = '';
          let answer = '';
          let inQuotes = false;
          let currentField = '';
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // Found the separator
              if (question === '') {
                question = currentField.trim();
                currentField = '';
              }
            } else {
              currentField += char;
            }
          }
          
          // Last field is the answer
          if (question !== '') {
            answer = currentField.trim();
          } else {
            // Try simple split if parsing fails
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
            if (parts.length >= 2) {
              question = parts[0];
              answer = parts.slice(1).join(','); // Join in case answer has commas
            }
          }
          
          if (question && answer) {
            parsed.push({ question, answer });
          }
        }
        
        setFlashcards(parsed);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading flashcards:', error);
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadFlashcards();
    }
  }, [isOpen]);
  
  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowAnswer(false);
      setCurrentIndex(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrevious = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleToggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="text-white">Loading FAQs...</div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="text-white">No flashcards found</div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* Flashcard Container */}
        <div className="relative">
          {/* Navigation Arrow Left - Mobile: inside card, Desktop: outside */}
          <button
            onClick={handlePrevious}
            disabled={flashcards.length <= 1}
            className="absolute left-2 md:left-0 top-1/2 md:-translate-x-full -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10"
          >
            <span className="material-symbols-outlined text-xl md:text-2xl">arrow_back</span>
          </button>

          {/* Flashcard Card - Portrait Mode */}
          <div
            className={`relative rounded-2xl p-6 md:p-8 lg:p-10 w-full aspect-[3/4] max-h-[600px] flex flex-col justify-between transition-all duration-500 ease-in-out ${
              showAnswer
                ? 'bg-black border-2 border-primary'
                : 'bg-primary border-2 border-primary'
            }`}
            style={{
              animation: showAnswer ? 'flash 0.3s ease-in-out' : 'none'
            }}
          >
            {/* Close Button - Inside the card */}
            <button
              onClick={onClose}
              className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10 ${
                showAnswer
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-black/10 hover:bg-black/20 text-black'
              }`}
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
            {/* Question/Answer Content */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center w-full">
                {!showAnswer ? (
                  <div className="space-y-6">
                    <h3
                      className={`text-2xl md:text-3xl font-bold leading-tight ${
                        showAnswer ? 'text-white' : 'text-black'
                      }`}
                    >
                      {currentCard.question}
                    </h3>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-white text-xl md:text-2xl leading-relaxed">
                      {currentCard.answer}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* See Answer Button / Card Number */}
            <div className="flex items-center justify-between mt-8">
              <div className="text-white/60 text-sm">
                {currentIndex + 1} / {flashcards.length}
              </div>
              {!showAnswer && (
                <button
                  onClick={handleToggleAnswer}
                  className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-black/90 transition-colors"
                >
                  See answer
                </button>
              )}
              {showAnswer && (
                <button
                  onClick={handleToggleAnswer}
                  className="px-6 py-3 bg-primary text-black rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                >
                  Show question
                </button>
              )}
            </div>
          </div>

          {/* Navigation Arrow Right - Mobile: inside card, Desktop: outside */}
          <button
            onClick={handleNext}
            disabled={flashcards.length <= 1}
            className="absolute right-2 md:right-0 top-1/2 md:translate-x-full -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-10"
          >
            <span className="material-symbols-outlined text-xl md:text-2xl">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardFAQ;

