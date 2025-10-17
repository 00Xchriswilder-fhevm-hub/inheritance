<template>
  <div class="glass-card">
    <div class="card-header">
      <div class="card-title">
        <svg class="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h2>FHE Voting</h2>
      </div>
        <button
          v-if="props.isConnected && props.fhevmStatus === 'ready'"
          @click="showCreateModal = true"
          :disabled="isLoading"
          class="btn-primary"
        >
          <svg v-if="isLoading" class="icon animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <svg v-else class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Create Session
        </button>
    </div>

    <div class="card-content">
       <div v-if="!props.isConnected || props.fhevmStatus !== 'ready'" class="empty-state">
        <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>Connect your wallet to use FHE Voting features</p>
      </div>

      <div v-else>
        <!-- FHE Voting Info -->
        <div class="voting-info">
          <div class="info-header">
            <svg class="info-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            <span class="info-title">How FHE Voting Works</span>
          </div>
          <div class="info-content">
            <p><strong>Encrypted Votes:</strong> Your Yes/No votes are encrypted using FHEVM before submission, keeping your choice private.</p>
            <p><strong>Oracle Callbacks:</strong> After voting ends, the oracle decrypts the encrypted tallies and reveals the results.</p>
            <p><strong>Privacy Preserving:</strong> Individual votes remain private until the session creator requests tally reveal.</p>
            <p><strong>Decryption Process:</strong> Only session creators can request tally reveal, which triggers oracle decryption of the encrypted vote counts.</p>
          </div>
        </div>

        <!-- Sessions List -->
        <div class="sessions-list">
          <div v-if="isLoading" class="loading-state">
            <svg class="loading-icon animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <p>Loading sessions...</p>
          </div>

          <div v-else-if="sessions.length === 0" class="empty-state">
            <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>No voting sessions found</p>
          </div>

          <div v-else class="sessions-grid">
            <div
              v-for="session in sessions.slice(currentPage * CARDS_PER_PAGE, (currentPage + 1) * CARDS_PER_PAGE)"
              :key="session.id"
              class="session-card"
            >
              <div class="session-header">
                <div class="session-info">
                  <h3 class="session-title">Session #{{ session.id }}</h3>
                  <p class="session-date">Created: {{ formatTime(session.endTime - newSessionDuration) }}</p>
                </div>
                <div class="session-status">
                  <div :class="['status-badge', isSessionActive(session.endTime) ? 'active' : 'ended']">
                    {{ isSessionActive(session.endTime) ? 'Active' : 'Ended' }}
                  </div>
                  <div v-if="session.hasVoted" class="voted-badge">Voted</div>
                </div>
              </div>

              <!-- Voting Interface -->
              <div v-if="isSessionActive(session.endTime) && !session.hasVoted" class="voting-interface">
                <div class="vote-buttons">
                  <button
                    @click="selectVote(session.id, 'yes')"
                    :class="['vote-button', 'yes-button', { 'selected': selectedVote === 'yes' }]"
                  >
                    <svg class="vote-icon" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    YES
                  </button>
                  <button
                    @click="selectVote(session.id, 'no')"
                    :class="['vote-button', 'no-button', { 'selected': selectedVote === 'no' }]"
                  >
                    <svg class="vote-icon" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                    NO
                  </button>
                </div>
                
                <button
                  v-if="selectedVote"
                  @click="castVote(session.id, selectedVote)"
                  :disabled="isVoting"
                  class="submit-vote-btn"
                >
                  <svg v-if="isVoting" class="icon animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <svg v-else class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Submit {{ selectedVote.toUpperCase() }} Vote
                </button>
              </div>

              <!-- Results -->
              <div v-if="session.resolved" class="results">
                <h4 class="results-title">Results</h4>
                <div class="results-stats">
                  <span class="yes-votes">Yes: {{ session.yesVotes }}</span>
                  <span class="no-votes">No: {{ session.noVotes }}</span>
                </div>
                <button 
                  @click="getFinalTally(session.id)"
                  class="get-tally-btn"
                >
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  Get Final Tally
                </button>
              </div>

              <!-- Request Tally Button -->
              <button
                v-if="session.canRequestTally"
                @click="requestTallyReveal(session.id)"
                :disabled="isRequestingTally"
                class="request-tally-btn"
              >
                <svg v-if="isRequestingTally" class="icon animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <svg v-else class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Request Tally Reveal
              </button>
            </div>
          </div>
          
          <!-- Pagination Controls -->
          <div v-if="sessions.length > CARDS_PER_PAGE" class="pagination-controls">
            <button
              @click="currentPage = Math.max(0, currentPage - 1)"
              :disabled="currentPage === 0"
              class="pagination-btn"
              :class="{ disabled: currentPage === 0 }"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            
            <span class="pagination-info">
              Page {{ currentPage + 1 }} of {{ Math.ceil(sessions.length / CARDS_PER_PAGE) }}
            </span>
            
            <button
              @click="currentPage = Math.min(Math.ceil(sessions.length / CARDS_PER_PAGE) - 1, currentPage + 1)"
              :disabled="currentPage >= Math.ceil(sessions.length / CARDS_PER_PAGE) - 1"
              class="pagination-btn"
              :class="{ disabled: currentPage >= Math.ceil(sessions.length / CARDS_PER_PAGE) - 1 }"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Create Session Modal -->
      <div v-if="showCreateModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Create Voting Session</h3>
            <button @click="showCreateModal = false" class="modal-close">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Vote Topic</label>
              <input
                v-model="sessionTopic"
                type="text"
                placeholder="Enter the topic for this vote..."
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">Duration (minutes)</label>
              <div class="duration-selector">
                <button
                  @click="newSessionDuration = Math.max(1, newSessionDuration - 1)"
                  class="duration-btn"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                  </svg>
                </button>
                <input
                  v-model.number="newSessionDuration"
                  type="number"
                  class="duration-input"
                  min="1"
                />
                <button
                  @click="newSessionDuration = newSessionDuration + 1"
                  class="duration-btn"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="modal-actions">
              <button
                @click="showCreateModal = false"
                class="btn-cancel"
              >
                Cancel
              </button>
              <button
                @click="async () => {
                  if (sessionTopic.trim()) {
                    // Cache the session topic
                    const newCachedSession = {
                      id: Date.now(),
                      topic: sessionTopic,
                      duration: newSessionDuration,
                      createdAt: new Date().toISOString()
                    };
                    cachedSessions.value = [...cachedSessions.value, newCachedSession];
                    
                    await createSession();
                    sessionTopic.value = '';
                    showCreateModal.value = false;
                  }
                }"
                :disabled="!sessionTopic.trim() || isLoading"
                class="btn-primary"
              >
                {{ isLoading ? 'Creating...' : 'Create Session' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ethers } from 'ethers'
import { initializeFheInstance, createEncryptedInput } from '../lib/fhevm'

// Contract ABI for SimpleVoting_uint32
const VOTING_CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "durationSeconds",
        "type": "uint256"
      }
    ],
    "name": "createSession",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "getSession",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "resolved",
        "type": "bool"
      },
      {
        "internalType": "uint32",
        "name": "yesVotes",
        "type": "uint32"
      },
      {
        "internalType": "uint32",
        "name": "noVotes",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSessionCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "hasVoted",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "requestTallyReveal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "externalEuint32",
        "name": "encryptedVote",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "proof",
        "type": "bytes"
      }
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

// Contract address for SimpleVoting_uint32
const VOTING_CONTRACT_ADDRESS = '0x7294A541222ce449faa2B8A7214C571b0fCAb52E'

interface VotingSession {
  id: number
  creator: string
  endTime: number
  resolved: boolean
  yesVotes: number
  noVotes: number
  hasVoted: boolean
  canRequestTally: boolean
}

interface Props {
  account: string
  chainId: number
  isConnected: boolean
  fhevmStatus: 'idle' | 'loading' | 'ready' | 'error'
  onMessage: (message: string) => void
}

const props = defineProps<Props>()

const sessions = ref<VotingSession[]>([])
const isLoading = ref(false)
const isVoting = ref(false)
const isRequestingTally = ref(false)
const selectedVote = ref<'yes' | 'no' | null>(null)
const newSessionDuration = ref(60) // 1 minute default
const showCreateModal = ref(false)
const sessionTopic = ref('')
const cachedSessions = ref<any[]>([])
const currentPage = ref(0)
const CARDS_PER_PAGE = 2

// Load all voting sessions
const loadSessions = async () => {
  if (!window.ethereum) return

  try {
    isLoading.value = true
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, provider)
    
    const sessionCount = await contract.getSessionCount()
    const sessionsData: VotingSession[] = []

    for (let i = 0; i < Number(sessionCount); i++) {
      try {
        const sessionData = await contract.getSession(i)
        const hasVoted = await contract.hasVoted(i, props.account)
        
        const session: VotingSession = {
          id: i,
          creator: sessionData.creator,
          endTime: Number(sessionData.endTime),
          resolved: sessionData.resolved,
          yesVotes: Number(sessionData.yesVotes),
          noVotes: Number(sessionData.noVotes),
          hasVoted,
          canRequestTally: sessionData.creator.toLowerCase() === props.account.toLowerCase() && 
                         !sessionData.resolved && 
                         Date.now() / 1000 > Number(sessionData.endTime)
        }
        
        sessionsData.push(session)
      } catch (error) {
        console.error(`Error loading session ${i}:`, error)
      }
    }

    sessions.value = sessionsData
  } catch (error) {
    console.error('Error loading sessions:', error)
    props.onMessage('Failed to load voting sessions')
  } finally {
    isLoading.value = false
  }
}

// Load sessions when component mounts or when account changes
watch([() => props.isConnected, () => props.fhevmStatus], async () => {
  if (props.isConnected && props.fhevmStatus === 'ready') {
    try {
      await loadSessions()
    } catch (error) {
      console.error('Error loading sessions:', error)
      props.onMessage('Failed to load voting sessions')
    }
  }
}, { immediate: true })

// Create a new voting session
const createSession = async () => {
  if (!window.ethereum || !props.account) return

  try {
    isLoading.value = true
    props.onMessage('Creating new voting session...')
    
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, signer)
    
    const tx = await contract.createSession(newSessionDuration.value * 60) // Convert minutes to seconds
    await tx.wait()
    
    props.onMessage('Voting session created successfully!')
    await loadSessions()
  } catch (error) {
    console.error('Error creating session:', error)
    props.onMessage('Failed to create voting session')
  } finally {
    isLoading.value = false
  }
}

// Select a vote
const selectVote = (sessionId: number, vote: 'yes' | 'no') => {
  selectedVote.value = selectedVote.value === vote ? null : vote
}

// Cast a vote
const castVote = async (sessionId: number, vote: 'yes' | 'no') => {
  if (!window.ethereum || !props.account) return

  try {
    isVoting.value = true
    props.onMessage(`Casting ${vote} vote...`)
    
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, signer)
    
    // Create encrypted vote
    const encryptedVote = await createEncryptedInput(VOTING_CONTRACT_ADDRESS, props.account, vote === 'yes' ? 1 : 0)
    
    // Use the encrypted data and proof from the FHEVM SDK
    const tx = await contract.vote(sessionId, encryptedVote.encryptedData, encryptedVote.proof)
    await tx.wait()
    
    props.onMessage(`Vote cast successfully!`)
    selectedVote.value = null
    await loadSessions()
  } catch (error) {
    console.error('Error casting vote:', error)
    props.onMessage('Failed to cast vote')
  } finally {
    isVoting.value = false
  }
}

// Request tally reveal
const requestTallyReveal = async (sessionId: number) => {
  if (!window.ethereum || !props.account) return

  try {
    isRequestingTally.value = true
    props.onMessage('Requesting tally reveal...')
    
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, signer)
    
    const tx = await contract.requestTallyReveal(sessionId)
    await tx.wait()
    
    props.onMessage('Tally reveal requested successfully!')
    await loadSessions()
  } catch (error) {
    console.error('Error requesting tally reveal:', error)
    props.onMessage('Failed to request tally reveal')
  } finally {
    isRequestingTally.value = false
  }
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

const isSessionActive = (endTime: number) => {
  return Date.now() / 1000 < endTime
}

// Get final tally for a resolved session
const getFinalTally = async (sessionId: number) => {
  if (!window.ethereum) return

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, VOTING_CONTRACT_ABI, provider)
    
    const sessionData = await contract.getSession(sessionId)
    
    // Update the session with fresh data
    const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
    if (sessionIndex !== -1) {
      sessions.value[sessionIndex] = {
        ...sessions.value[sessionIndex],
        resolved: sessionData.resolved,
        yesVotes: Number(sessionData.yesVotes),
        noVotes: Number(sessionData.noVotes)
      }
    }
    
    props.onMessage(`Final tally for Session #${sessionId}: Yes: ${sessionData.yesVotes}, No: ${sessionData.noVotes}`)
  } catch (error) {
    console.error('Error getting final tally:', error)
    props.onMessage('Failed to get final tally')
  }
}
</script>

<style scoped>
.create-session-form {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #0A0A0A;
  border: 1px solid rgba(255, 235, 59, 0.3);
  border-radius: 0.5rem;
  display: flex;
  align-items: end;
  gap: 1rem;
}

.form-group {
  flex: 1;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #D1D5DB;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  background: #1A1A1A;
  border: 1px solid #4B5563;
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
}

.form-input:focus {
  border-color: #FFEB3B;
  outline: none;
}

.sessions-list {
  margin-top: 1rem;
}

.sessions-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Pagination Controls */
.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.pagination-btn {
  padding: 0.5rem 0.75rem;
  background: #374151;
  color: #D1D5DB;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-btn:hover:not(.disabled) {
  background: #4B5563;
}

.pagination-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #9CA3AF;
}

.session-card {
  padding: 1rem;
  background: #0A0A0A;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  transition: all 0.3s;
}

.session-card:hover {
  border-color: #FFEB3B;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.session-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
  margin: 0;
}

.session-date {
  font-size: 0.875rem;
  color: #9CA3AF;
  margin: 0;
}

.session-status {
  text-align: right;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.2);
  color: #4ADE80;
}

.status-badge.ended {
  background: rgba(239, 68, 68, 0.2);
  color: #F87171;
}

.voted-badge {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #FFEB3B;
}

.voting-interface {
  margin-bottom: 1rem;
}

.vote-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.vote-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.vote-icon {
  width: 1rem;
  height: 1rem;
}

.yes-button {
  background: #374151;
  color: #D1D5DB;
}

.yes-button:hover {
  background: #4B5563;
}

.yes-button.selected {
  background: #059669;
  color: white;
}

.no-button {
  background: #374151;
  color: #D1D5DB;
}

.no-button:hover {
  background: #4B5563;
}

.no-button.selected {
  background: #DC2626;
  color: white;
}

.submit-vote-btn {
  width: 100%;
  padding: 0.75rem;
  background: #FFEB3B;
  color: #000;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.submit-vote-btn:hover:not(:disabled) {
  background: #FDD835;
}

.submit-vote-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.results {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #1A1A1A;
  border-radius: 0.5rem;
}

.results-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #D1D5DB;
  margin: 0 0 0.5rem 0;
}

.results-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

/* Results Styles */
.results {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #1A1A1A;
  border-radius: 0.5rem;
}

.results-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #D1D5DB;
  margin-bottom: 0.5rem;
}

.results-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.yes-votes {
  color: #4ADE80;
}

.no-votes {
  color: #F87171;
}

.get-tally-btn {
  width: 100%;
  padding: 0.5rem;
  background: #FFEB3B;
  color: #0A0A0A;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.get-tally-btn:hover {
  background: #FDD835;
  transform: translateY(-1px);
}

.get-tally-btn .icon {
  width: 1rem;
  height: 1rem;
}

.request-tally-btn {
  width: 100%;
  padding: 0.75rem;
  background: #374151;
  color: white;
  border: 1px solid #4B5563;
  border-radius: 0.5rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.request-tally-btn:hover:not(:disabled) {
  background: #4B5563;
  border-color: #6B7280;
}

.request-tally-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state {
  text-align: center;
  padding: 2rem;
}

.loading-icon {
  width: 2rem;
  height: 2rem;
  color: #FFEB3B;
  margin: 0 auto 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: #3A3A3A;
  margin: 0 auto 1rem;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Voting Info Styles */
.voting-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #0A0A0A;
  border: 1px solid rgba(255, 235, 59, 0.3);
  border-radius: 0.5rem;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.info-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #FFEB3B;
}

.info-title {
  color: #FFEB3B;
  font-weight: 600;
  font-size: 0.875rem;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-content p {
  font-size: 0.875rem;
  color: #D1D5DB;
  margin: 0;
}

.info-content strong {
  color: #FFEB3B;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-content {
  background: #1A1A1A;
  border: 1px solid rgba(255, 235, 59, 0.3);
  border-radius: 0.5rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 28rem;
  margin: 1rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.modal-close {
  color: #9CA3AF;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
}

.modal-close:hover {
  color: white;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.duration-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.duration-btn {
  padding: 0.5rem;
  background: #374151;
  border: 2px solid #4B5563;
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
}

.duration-btn:hover {
  border-color: #FFEB3B;
  background: #4B5563;
  transform: scale(1.05);
}

.duration-btn:active {
  transform: scale(0.95);
}

.duration-input {
  flex: 1;
  padding: 0.75rem;
  background: #0A0A0A;
  border: 1px solid #4B5563;
  border-radius: 0.5rem;
  color: white;
  text-align: center;
}

.duration-input:focus {
  border-color: #FFEB3B;
  outline: none;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  padding-top: 1rem;
}

.btn-cancel {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #4B5563;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #6B7280;
}
</style>
