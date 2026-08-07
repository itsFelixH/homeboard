/**
 * Hogwarts module - daily rotating Harry Potter content
 * Rotates through 6 different content types:
 *   0: Spell of the Day
 *   1: Character Profile (wand, patronus)
 *   2: House Spotlight
 *   3: Book Spotlight
 *   4: Did You Know (trivia)
 *   5: Actor & Character
 * APIs: hp-api.onrender.com + potterapi-fedeperin.vercel.app (free, no key)
 */
const Hogwarts = (() => {
  let spells = [];
  let characters = [];
  let books = [];
  let fedChars = [];
  let currentView = -1; // -1 means "daily default"
  const TOTAL_VIEWS = 6;

  const HOUSE_INFO = {
    Gryffindor: { emoji: '🦁', trait: 'Bravery & Courage', colors: 'Scarlet & Gold', founder: 'Godric Gryffindor' },
    Slytherin: { emoji: '🐍', trait: 'Ambition & Cunning', colors: 'Green & Silver', founder: 'Salazar Slytherin' },
    Ravenclaw: { emoji: '🦅', trait: 'Wit & Wisdom', colors: 'Blue & Bronze', founder: 'Rowena Ravenclaw' },
    Hufflepuff: { emoji: '🦡', trait: 'Loyalty & Patience', colors: 'Yellow & Black', founder: 'Helga Hufflepuff' }
  };

  // Curated trivia facts
  const TRIVIA = [
    { fact: 'J.K. Rowling and Harry Potter share the same birthday: July 31st.', category: 'Author' },
    { fact: 'The word "Dumbledore" is an Old English word for bumblebee.', category: 'Etymology' },
    { fact: 'Hogwarts was founded around 990 A.D., making it over 1000 years old.', category: 'History' },
    { fact: 'There are 142 staircases in Hogwarts castle.', category: 'Hogwarts' },
    { fact: 'The first Harry Potter book was rejected by 12 publishers before Bloomsbury accepted it.', category: 'Publishing' },
    { fact: 'Voldemort\'s name means "flight of death" in French.', category: 'Etymology' },
    { fact: 'The Hogwarts motto "Draco dormiens nunquam titillandus" means "Never tickle a sleeping dragon."', category: 'Hogwarts' },
    { fact: 'Alan Rickman was told Snape\'s secret ending before anyone else, to help him build the character.', category: 'Films' },
    { fact: 'Rupert Grint actually fell asleep during the filming of the hospital wing scene in Prisoner of Azkaban.', category: 'Films' },
    { fact: 'The Weasley twins were born on April Fools\' Day (April 1st).', category: 'Characters' },
    { fact: 'Hermione\'s patronus is an otter — J.K. Rowling\'s favourite animal.', category: 'Characters' },
    { fact: 'Over 500 million copies of the Harry Potter books have been sold worldwide.', category: 'Publishing' },
    { fact: 'The Elder Wand is the only known wand to contain a Thestral hair core.', category: 'Magic' },
    { fact: 'Dementors are based on J.K. Rowling\'s experience with depression.', category: 'Author' },
    { fact: 'The name "Sirius" comes from the Dog Star, fitting for someone who transforms into a dog.', category: 'Etymology' },
    { fact: 'Platform 9¾ actually exists at King\'s Cross station in London as a tourist attraction.', category: 'Real World' },
    { fact: 'In the films, Daniel Radcliffe went through about 160 pairs of glasses.', category: 'Films' },
    { fact: 'Moaning Myrtle is the only ghost whose cause of death is directly shown in the series.', category: 'Characters' }
  ];

  function init() {
    fetchData();
  }

  async function fetchData() {
    try {
      const [spellRes, charRes, bookRes, fedCharRes] = await Promise.all([
        fetch('https://hp-api.onrender.com/api/spells'),
        fetch('https://hp-api.onrender.com/api/characters'),
        fetch('https://potterapi-fedeperin.vercel.app/en/books'),
        fetch('https://potterapi-fedeperin.vercel.app/en/characters')
      ]);

      if (spellRes.ok) spells = await spellRes.json();
      if (charRes.ok) characters = await charRes.json();
      if (bookRes.ok) books = await bookRes.json();
      if (fedCharRes.ok) fedChars = await fedCharRes.json();

      render();
    } catch (err) {
      console.error('Hogwarts API fetch failed:', err);
      document.getElementById('spell-content').innerHTML =
        '<span class="spell-error">Could not load magical content</span>';
    }
  }

  function getDaySeed() {
    const now = new Date();
    return now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
  }

  function pickFromArray(arr, offset) {
    if (!arr || arr.length === 0) return null;
    return arr[(getDaySeed() + (offset || 0)) % arr.length];
  }

  function render() {
    const container = document.getElementById('spell-content');
    const dayType = currentView >= 0 ? currentView : getDaySeed() % TOTAL_VIEWS;

    // Add nav arrows in card header
    let navContainer = document.querySelector('.card-spell .spell-nav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'spell-nav';
      const header = document.querySelector('.card-spell .card-header');
      if (header) header.appendChild(navContainer);
    }
    const prevIdx = (dayType - 1 + TOTAL_VIEWS) % TOTAL_VIEWS;
    const nextIdx = (dayType + 1) % TOTAL_VIEWS;
    navContainer.innerHTML = `<div class="card-nav">
      <button class="card-nav-btn" onclick="Hogwarts.switchTo(${prevIdx})" aria-label="Previous">‹</button>
      <span class="card-nav-label">${dayType + 1}/${TOTAL_VIEWS}</span>
      <button class="card-nav-btn" onclick="Hogwarts.switchTo(${nextIdx})" aria-label="Next">›</button>
    </div>`;

    let html = '';

    switch (dayType) {
      case 0: html = renderSpell(); break;
      case 1: html = renderCharacterProfile(); break;
      case 2: html = renderHouseSpotlight(); break;
      case 3: html = renderBookSpotlight(); break;
      case 4: html = renderTrivia(); break;
      case 5: html = renderActor(); break;
    }

    container.innerHTML = html || '<span class="spell-error">No magical data</span>';
  }

  function renderSpell() {
    const spell = pickFromArray(spells);
    if (!spell) return '';

    // Also add a quick trivia at the bottom
    const trivia = pickFromArray(TRIVIA, 13);

    return `<div class="spell-main">
      <span class="spell-tag">⚡ Spell of the Day</span>
      <span class="spell-name">✨ ${spell.name}</span>
      <span class="spell-desc">${spell.description || 'Unknown effect'}</span>
    </div>
    ${trivia ? `<div class="spell-trivia"><span class="spell-desc">💡 ${trivia.fact}</span></div>` : ''}`;
  }

  function renderCharacterProfile() {
    const withWand = characters.filter(c => c.wand?.wood && c.house);
    const char = pickFromArray(withWand.length > 0 ? withWand : characters.filter(c => c.house));
    if (!char) return '';

    const emoji = HOUSE_INFO[char.house]?.emoji || '🧙';
    const wand = char.wand;
    const wandStr = wand?.wood
      ? `${wand.wood}, ${wand.core || '?'}${wand.length ? ', ' + wand.length + '"' : ''}`
      : null;

    let details = [];
    if (char.house) details.push(`<span class="spell-detail">${char.house}</span>`);
    if (wandStr) details.push(`<span class="spell-detail">🪄 ${wandStr}</span>`);
    if (char.patronus) details.push(`<span class="spell-detail">Patronus: ${char.patronus}</span>`);
    if (char.ancestry) details.push(`<span class="spell-detail">${char.ancestry}</span>`);

    return `<div class="spell-profile">
      <span class="spell-tag">🧙 Character of the Day</span>
      <span class="spell-char-name">${emoji} ${char.name}</span>
      <div class="spell-details">${details.join('')}</div>
    </div>`;
  }

  function renderHouseSpotlight() {
    const houses = Object.keys(HOUSE_INFO);
    const house = houses[getDaySeed() % houses.length];
    const info = HOUSE_INFO[house];

    const members = characters.filter(c => c.house === house);
    const notable = members.filter(c => c.hogwartsStudent || c.hogwartsStaff).slice(0, 5);

    let membersHtml = '';
    if (notable.length > 0) {
      membersHtml = `<div class="spell-members">${notable.map(c => c.name).join(' · ')}</div>`;
    }

    return `<div class="spell-house">
      <span class="spell-tag">🏰 House Spotlight</span>
      <span class="spell-house-name">${info.emoji} ${house}</span>
      <div class="spell-details">
        <span class="spell-detail">${info.trait}</span>
        <span class="spell-detail">${info.colors}</span>
        <span class="spell-detail">Founded by ${info.founder}</span>
      </div>
      ${membersHtml}
    </div>`;
  }

  function renderBookSpotlight() {
    const book = pickFromArray(books);
    if (!book) return '';

    const desc = book.description
      ? (book.description.length > 140 ? book.description.slice(0, 140) + '…' : book.description)
      : '';

    return `<div class="spell-book">
      <span class="spell-tag">📖 Book Spotlight</span>
      <span class="spell-name">${book.title}</span>
      <span class="spell-desc">${desc}</span>
      <span class="spell-detail">${book.pages} pages · ${book.releaseDate}</span>
    </div>`;
  }

  function renderTrivia() {
    const trivia = pickFromArray(TRIVIA);
    if (!trivia) return '';

    // Add a spell too
    const spell = pickFromArray(spells, 5);

    let spellHtml = '';
    if (spell) {
      spellHtml = `<div class="spell-character">
        <span class="spell-name">✨ ${spell.name}</span>
        <span class="spell-desc">${spell.description || 'Unknown effect'}</span>
      </div>`;
    }

    return `<div class="spell-main">
      <span class="spell-tag">💡 Did You Know</span>
      <span class="spell-desc">${trivia.fact}</span>
      <span class="spell-detail">${trivia.category}</span>
    </div>
    ${spellHtml}`;
  }

  function renderActor() {
    // Use fedeperin API which has actor info
    const withActor = fedChars.filter(c => c.interpretedBy);
    const char = pickFromArray(withActor);
    if (!char) return renderCharacterProfile(); // fallback

    const emoji = HOUSE_INFO[char.hogwartsHouse]?.emoji || '🧙';
    const children = char.children && char.children.length > 0
      ? `<span class="spell-detail">Children: ${char.children.join(', ')}</span>`
      : '';

    return `<div class="spell-profile">
      <span class="spell-tag">🎬 Behind the Magic</span>
      <span class="spell-char-name">${emoji} ${char.fullName}</span>
      <div class="spell-details">
        <span class="spell-detail">Played by ${char.interpretedBy}</span>
        ${char.hogwartsHouse ? `<span class="spell-detail">${char.hogwartsHouse}</span>` : ''}
        ${char.birthdate ? `<span class="spell-detail">Born: ${char.birthdate}</span>` : ''}
        ${children}
      </div>
    </div>`;
  }

  function switchTo(index) {
    currentView = index;
    render();
  }

  return { init, switchTo };
})();
