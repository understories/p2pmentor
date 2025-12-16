/**
 * Web3Privacy Academy Library - Quest Materials
 *
 * Source: https://academy.web3privacy.info/p/library
 *
 * MVP: Foundational documents and recent articles
 */

import type { LearnerQuestMaterial } from './learnerQuest';

export const WEB3PRIVACY_FOUNDATIONS_MATERIALS: LearnerQuestMaterial[] = [
  {
    id: 'crypto-anarchist-manifesto',
    title: 'The Crypto Anarchist Manifesto',
    author: 'Timothy May',
    year: 1988,
    url: 'https://activism.net/cypherpunk/crypto-anarchist-manifesto.html',
    category: 'foundational',
    description: 'The Manifesto envisions a future where individuals can communicate and conduct transactions anonymously, outside the control of governments and centralized institutions. It highlights the potential for cryptography to fundamentally alter the nature of government regulation and societal structures.',
  },
  {
    id: 'cypherpunk-manifesto',
    title: 'The Cypherpunk Manifesto',
    author: 'Eric Hughes',
    year: 1993,
    url: 'https://www.activism.net/cypherpunk/manifesto.html',
    category: 'foundational',
    description: 'The Manifesto advocates for privacy in the digital age, distinguishing it from secrecy. It emphasizes using cryptography and anonymous systems to protect privacy, arguing that individuals must defend themselves and safeguard personal information.',
  },
  {
    id: 'crypto-anarchy-virtual-communities',
    title: 'Crypto Anarchy and Virtual Communities',
    author: 'Timothy C. May',
    year: 1994,
    url: 'https://nakamotoinstitute.org/crypto-anarchy-and-virtual-communities/',
    category: 'foundational',
    description: 'The essay argues that strong cryptography and virtual networks will transform economic and social systems, enabling untraceable communications, anonymous identities, and decentralized finance. This technological shift challenges government control and fosters a new era of personal freedom and privacy in cyberspace.',
  },
  {
    id: 'cyphernomicon',
    title: 'The Cyphernomicon',
    author: 'Timothy C. May',
    year: 1994,
    url: 'https://nakamotoinstitute.org/cyphernomicon/',
    category: 'foundational',
    description: 'An extensive FAQ and philosophical document by Tim May that outlines the principles, goals, and technological foundations of the Cypherpunk movement.',
  },
  {
    id: 'declaration-independence-cyberspace',
    title: 'Declaration of independence of cyberspace',
    author: 'John Perry Barlow',
    year: 1996,
    url: 'https://www.eff.org/cyberspace-independence',
    category: 'foundational',
    description: 'The co-founder of the Electronic Frontier Foundation argues that governments have no authority in the digital realm. He advocates for a free, self-governing cyberspace, independent of traditional legal constraints, and calls for a more humane and fair digital world beyond government control.',
  },
  {
    id: 'political-history-daos',
    title: 'A Political History of DAOs',
    author: 'Kelsie Nabben',
    year: 2022,
    url: 'https://kelsienabben.substack.com/p/a-political-history-of-daos',
    category: 'recent',
    description: 'The article explores the Cypherpunks Mailing List, a 1990s forum that influenced the development of cryptocurrencies and decentralized technologies. It highlights how their vision of cryptography as a tool for self-governance laid the foundation for today\'s blockchain and Web3 innovations.',
  },
  {
    id: 'core-crypto-punks-principles',
    title: 'The Core of Crypto is Punks and Principles',
    author: 'Piergiorgio Catti De Gasperi',
    year: 2023,
    url: 'https://www.coindesk.com/consensus-magazine/2023/05/15/the-core-of-crypto-is-punks-and-principles/',
    category: 'recent',
    description: 'The article examines how privacy-focused intellectuals, the Cypherpunks, pioneered the foundation for Web3. It highlights their concerns about centralization, privacy, and financial transparency, which led to innovations like Bitcoin and Ethereum. By understanding these ideological origins, the article underscores the significance of appreciating Web3\'s potential to create a decentralized and fair digital future.',
  },
  {
    id: 'make-ethereum-cypherpunk-again',
    title: 'Make Ethereum Cypherpunk Again',
    author: 'Vitalik Buterin',
    year: 2023,
    url: 'https://vitalik.ca/general/2023/12/28/cypherpunk.html',
    category: 'recent',
    description: 'Ethereum co-founder calls for a return to the cypherpunk ideals of a decentralized and open crypto ecosystem. It critiques the shift towards financialization and highlights recent advancements like rollups and zero-knowledge proofs as opportunities to realign with these original values.',
  },
  {
    id: 'make-public-policy-cypherpunk-again',
    title: 'Make Public Policy Cypherpunk Again',
    author: 'Peter Van Valkenburgh',
    year: 2024,
    url: 'https://www.coincenter.org/make-public-policy-cypherpunk-again/',
    category: 'recent',
    description: 'Director of Research at Coin Center, reflecting on the state of the crypto and Cypherpunk movements. He critiques the shift from Cypherpunk ideals towards profit-driven activities, warns of increasing government scrutiny, and advocates for stronger privacy protections, decentralized governance, and adherence to the original principles of the movement.',
  },
];

export const WEB3PRIVACY_FOUNDATIONS_QUEST = {
  questId: 'web3privacy_foundations',
  title: 'Web3Privacy Foundations',
  description: 'Explore the foundational documents and recent articles that form the bedrock of the Cypherpunk movement and Web3 privacy principles. These materials provide deep understanding of the ideals and motivations that inspired activists to leverage technology in the defense of individual rights and freedoms.',
  source: 'https://academy.web3privacy.info/p/library',
  materials: WEB3PRIVACY_FOUNDATIONS_MATERIALS,
};

