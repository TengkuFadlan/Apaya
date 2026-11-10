import { useEffect, useMemo, useState } from 'react'

const providers = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  nanogpt: { url: 'https://nano-gpt.com/api/v1', model: '' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  anthropic: { url: 'https://api.anthropic.com/v1', model: 'claude-3-5-haiku-latest' },
  custom: { url: '', model: '' },
}
const initialData = { days: {}, profile: {}, chats: {} }
const initialPrefs = { provider: 'openai', baseUrl: providers.openai.url, model: providers.openai.model }
const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dateFromKey = (key) => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day) }
const todayKey = () => localDateKey(new Date())
const readableDate = (key, options = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('id-ID', options).format(dateFromKey(key))
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const systemPrompt = (profile, context, date) => `Kamu adalah teman refleksi harian yang hangat, suportif, dan tidak menghakimi. Berkomunikasilah dalam bahasa Indonesia yang alami. Validasi perasaan pengguna tanpa berpura-pura sebagai psikolog/terapis atau mendiagnosis. Berikan saran praktis yang lembut dan tidak memaksa; jangan menyamakan produktivitas dengan nilai diri. Jika pengguna mengungkapkan bahaya langsung atau niat menyakiti diri, dorong mereka segera menghubungi orang tepercaya dan layanan darurat setempat. Konteks profil (hobi, lifestyle, tujuan): ${JSON.stringify(profile || {})}. Berikut jurnal untuk tujuh hari hingga tanggal percakapan (${date}); pakai sebagai konteks untuk melihat pola, dan jangan mengarang detail yang tidak tercatat: ${context}.`

export default function App() {
  const [data, setData] = useState(() => readStorage('ruang-data', initialData))
  const [prefs, setPrefs] = useState(() => readStorage('ruang-prefs', initialPrefs))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [page, setPage] = useState('journal')
  const [toast, setToast] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityText, setActivityText] = useState('')
  const [activityTime, setActivityTime] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState('Belum ada API key tersimpan.')
  const [sending, setSending] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [reflection, setReflection] = useState('')
  const [profile, setProfile] = useState({ name: '', hobbies: '', lifestyle: '', goals: '' })
  const record = data.days[selectedDate] || { activities: [], reflection: '' }
  const activities = useMemo(() => [...(record.activities || [])].sort((a, b) => a.time.localeCompare(b.time)), [record.activities])
  const chatMessages = data.chats[selectedDate] || []

  useEffect(() => { localStorage.setItem('ruang-data', JSON.stringify(data)) }, [data])
  useEffect(() => { localStorage.setItem('ruang-prefs', JSON.stringify(prefs)) }, [prefs])
  useEffect(() => {
    setReflection(record.reflection || '')
    setProfile({ name: data.profile?.name || '', hobbies: data.profile?.hobbies || '', lifestyle: data.profile?.lifestyle || '', goals: data.profile?.goals || '' })
  }, [selectedDate, data.profile, record.reflection])
  useEffect(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - 6)
    setData((current) => {
      const days = Object.fromEntries(Object.entries(current.days || {}).filter(([key]) => dateFromKey(key) >= cutoff))
      const chats = Object.fromEntries(Object.entries(current.chats || {}).filter(([key]) => dateFromKey(key) >= cutoff))
      return { ...current, days, chats }
    })
    window.ruang?.hasApiKey().then((hasKey) => setSettingsStatus(hasKey ? 'API key tersimpan dengan aman.' : 'Belum ada API key tersimpan.')).catch(() => {})
  }, [])

  function notify(message) {
    setToast(message)
    window.clearTimeout(notify.timer)
    notify.timer = window.setTimeout(() => setToast(''), 2400)
  }
  function updateDay(updater) {
    setData((current) => {
      const previous = current.days[selectedDate] || { activities: [], reflection: '' }
      return { ...current, days: { ...current.days, [selectedDate]: updater(previous) } }
    })
  }
  function changeChat(messages, date = selectedDate) {
    setData((current) => ({ ...current, chats: { ...current.chats, [date]: messages } }))
  }
  function openActivity() {
    setActivityText('')
    setActivityTime(new Date().toTimeString().slice(0, 5))
    setActivityOpen(true)
  }
  function saveActivity(event) {
    event.preventDefault()
    const text = activityText.trim()
    if (!text) return
    updateDay((current) => ({ ...current, activities: [...(current.activities || []), { id: crypto.randomUUID(), time: activityTime, text }] }))
    setActivityOpen(false)
    notify('Aktivitas tersimpan.')
  }
  function saveReflection() {
    updateDay((current) => ({ ...current, reflection: reflection.trim() }))
    notify('Catatan perasaan tersimpan.')
  }
  function saveProfile() {
    setData((current) => ({ ...current, profile: Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])) }))
    notify('Profilmu tersimpan.')
  }
  function changeProvider(provider) {
    setPrefs((current) => ({ ...current, provider, baseUrl: providers[provider].url, model: providers[provider].model }))
  }
  async function saveSettings() {
    const next = { ...prefs, baseUrl: prefs.baseUrl.trim(), model: prefs.model.trim() }
    if (!next.baseUrl || !next.model) { notify('Base URL dan model perlu diisi.'); return }
    try {
      if (apiKey.trim()) await window.ruang.setApiKey(apiKey.trim())
      setPrefs(next)
      setApiKey('')
      setSettingsStatus(apiKey.trim() ? 'API key tersimpan dengan aman.' : 'Pengaturan model tersimpan.')
      notify('Pengaturan AI tersimpan.')
    } catch (error) { notify(error.message) }
  }
  async function removeKey() {
    try {
      await window.ruang.setApiKey('')
      setApiKey('')
      setSettingsStatus('API key dihapus dari perangkat.')
      notify('API key berhasil dihapus.')
    } catch (error) { notify(error.message) }
  }
  function journalContext(date) {
    const end = dateFromKey(date)
    const days = Array.from({ length: 7 }, (_, index) => {
      const current = new Date(end); current.setDate(end.getDate() - (6 - index))
      const key = localDateKey(current); const item = data.days[key]
      if (!item || (!(item.activities || []).length && !item.reflection?.trim())) return null
      return { date: readableDate(key), activities: [...(item.activities || [])].sort((a, b) => a.time.localeCompare(b.time)).map(({ time, text }) => ({ time, activity: text })), reflection: item.reflection || '' }
    }).filter(Boolean)
    return days.length ? JSON.stringify(days) : 'Belum ada aktivitas atau refleksi yang dicatat dalam rentang ini.'
  }
  async function sendChat() {
    const text = chatInput.trim()
    if (!text || sending) return
    if (!prefs.model || !prefs.baseUrl) { setPage('settings'); notify('Atur model AI terlebih dahulu.'); return }
    const date = selectedDate
    const messages = [...(data.chats[date] || []), { role: 'user', content: text }]
    changeChat(messages, date)
    setChatInput('')
    setSending(true)
    try {
      const prompt = [{ role: 'system', content: systemPrompt(data.profile, journalContext(date), date) }, ...messages.map(({ role, content }) => ({ role, content }))]
      const answer = await window.ruang.chat({ ...prefs, messages: prompt })
      changeChat([...messages, { role: 'assistant', content: answer }], date)
    } catch (error) {
      changeChat([...messages, { role: 'assistant', content: `Aku belum bisa tersambung: ${error.message}\n\nPeriksa API key, model, dan koneksi internet di Pengaturan AI.` }], date)
    } finally { setSending(false) }
  }
  async function regenerateLatest(index) {
    const date = selectedDate
    const messages = [...(data.chats[date] || [])]
    if (index !== messages.length - 1 || messages[index]?.role !== 'assistant' || messages[index - 1]?.role !== 'user' || sending) return
    messages.pop(); changeChat(messages, date); setSending(true)
    try {
      const prompt = [{ role: 'system', content: systemPrompt(data.profile, journalContext(date), date) }, ...messages.map(({ role, content }) => ({ role, content }))]
      const answer = await window.ruang.chat({ ...prefs, messages: prompt })
      changeChat([...messages, { role: 'assistant', content: answer }], date)
    } catch (error) {
      changeChat([...messages, { role: 'assistant', content: `Aku belum bisa tersambung: ${error.message}\n\nPeriksa API key, model, dan koneksi internet di Pengaturan AI.` }], date)
    } finally { setSending(false) }
  }

  const today = selectedDate === todayKey()
  const latestAssistant = chatMessages.findLastIndex((message) => message.role === 'assistant')
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - index); return { date, key: localDateKey(date) } })
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 6 + index); const key = localDateKey(date); return { date, key, count: data.days[key]?.activities?.length || 0 } })

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('journal') }} aria-label="Beranda Apaya"><span className="brand-mark">a.</span><span>apaya<span className="brand-dot">.</span></span></a>
      <div className="sidebar-label">MENU</div>
      <nav className="nav-list">
        <NavButton pageName="journal" page={page} onClick={setPage} icon="◷">Jurnal harian</NavButton>
        <NavButton pageName="insights" page={page} onClick={setPage} icon="✳">Refleksi & insight</NavButton>
        <NavButton pageName="profile" page={page} onClick={setPage} icon="♡">Tentang saya</NavButton>
      </nav>
      <div className="sidebar-label days-label">7 HARI TERAKHIR <button onClick={() => setSelectedDate(todayKey())} className="text-action">Hari ini</button></div>
      <div className="day-list">{days.map(({ date, key }, index) => <button key={key} onClick={() => setSelectedDate(key)} className={`day-item ${key === selectedDate ? 'selected' : ''}`}><span className="day-main"><span className="day-name">{index === 0 ? 'Hari ini' : index === 1 ? 'Kemarin' : new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date)}</span><span className="day-date">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date)}</span></span><span className="day-count">{data.days[key]?.activities?.length ? `${data.days[key].activities.length} aktivitas` : ''}</span></button>)}</div>
      <div className="sidebar-bottom"><div className="privacy-note"><span className="lock-icon">♧</span><div><strong>Ruang pribadimu</strong><small>Catatan tersimpan di perangkat ini.</small></div></div>
        <NavButton pageName="settings" page={page} onClick={setPage} icon="⚙" extraClass="settings-nav">Pengaturan AI</NavButton>
        <div className="user-chip"><div className="avatar">✿</div><div><strong>{data.profile?.name || 'Teman Apaya'}</strong><small>Perjalananmu, versimu</small></div><span className="online-dot" /></div>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Apaya <span>/</span> <strong>{({ journal: 'Jurnal harian', insights: 'Refleksi & insight', profile: 'Tentang saya', settings: 'Pengaturan AI' })[page]}</strong></div><button className="icon-button" onClick={() => setPage('settings')} title="Pengaturan">⚙</button></header>
      {page === 'journal' && <section className="page active-page"><div className="page-heading"><div><div className="eyebrow">{today ? 'HARI INI' : readableDate(selectedDate, { weekday: 'long' }).toUpperCase()}</div><h1>{today ? 'Selamat datang kembali' : 'Hari yang kamu jalani'}<span className="heading-period">.</span></h1><p className="subtitle">Setiap hal kecil yang kamu catat berarti.</p></div><button className="button button-primary" onClick={openActivity}><span>＋</span> Catat aktivitas</button></div>
        <div className="journal-layout"><div className="journal-column"><div className="card day-card"><div className="card-heading"><div><h2>Perjalanan harimu</h2><p>{today ? 'Aktivitas yang kamu jalani hari ini' : `Aktivitas yang kamu jalani ${readableDate(selectedDate, { day: 'numeric', month: 'long' })}`}</p></div><span className="entry-count">{activities.length} aktivitas</span></div><div className="timeline">{activities.length ? activities.map((item) => <div key={item.id} className="timeline-item"><span className="timeline-time">{item.time}</span><span className="timeline-dot" /><span className="activity-text">{item.text}</span><button className="activity-delete" title="Hapus aktivitas" onClick={() => { updateDay((current) => ({ ...current, activities: current.activities.filter((activity) => activity.id !== item.id) })); notify('Aktivitas dihapus.') }}>×</button></div>) : <div className="empty-state"><div className="empty-illustration">☼</div><strong>{today ? 'Pelan-pelan saja.' : 'Belum ada catatan untuk hari ini.'}</strong>{today ? 'Tambahkan aktivitas kecil saat kamu siap.' : 'Kamu bisa menambahkan aktivitas hari sebelumnya kapan saja.'}</div>}</div><button className="add-inline" onClick={openActivity}>＋ Tambahkan aktivitas</button></div>
          <div className="card reflection-card"><div className="card-heading"><div><h2>Catatan perasaan</h2><p>Bagaimana harimu terasa buatmu?</p></div><span className="reflection-spark">✳</span></div><textarea rows="3" value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Tulis apa yang ada di pikiranmu. Nggak harus rapi, cukup jujur…" /><div className="reflection-footer"><span>Hanya kamu yang bisa melihat catatan ini.</span><button className="button button-soft" onClick={saveReflection}>Simpan catatan</button></div></div></div>
          <aside className="right-column"><Snapshot today={today} activities={activities} /><div className="card chat-card"><div className="chat-heading"><div className="assistant-avatar">✳</div><div><h3>Teman refleksimu</h3><p><span className="online-dot" /> Siap mendengarkan</p></div><button className="chat-menu" onClick={() => { if (chatMessages.length && window.confirm('Hapus semua pesan chat untuk hari ini?')) { setData((current) => { const chats = { ...current.chats }; delete chats[selectedDate]; return { ...current, chats } }); notify('Chat hari ini dihapus.') } }} title="Hapus semua chat">···</button></div>
            <div className="chat-messages">{chatMessages.length ? chatMessages.map((message, index) => <div key={`${index}-${message.role}`} className={`chat-message ${message.role === 'user' ? 'user' : ''}`}>{message.content}{index === latestAssistant && <button className="chat-regenerate" title="Buat ulang jawaban" onClick={() => regenerateLatest(index)}>↻</button>}<button className="chat-delete" title="Hapus pesan" onClick={() => changeChat(chatMessages.filter((_, messageIndex) => messageIndex !== index))}>×</button></div>) : <div className="chat-welcome">Hai{data.profile?.name ? `, ${data.profile.name}` : ''}. Aku di sini untuk mendengarkan, bukan menghakimi. Kamu bisa cerita tentang harimu kapan saja. 🌿</div>}{sending && <div className="chat-message loading-note">Sedang merangkai jawaban…</div>}</div>
            <div className="chat-input-wrap"><textarea rows="1" value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat() } }} placeholder="Ceritakan apa yang kamu rasakan…" /><button disabled={sending} onClick={sendChat} className="send-button" aria-label="Kirim pesan">↑</button></div><div className="chat-footnote">AI bisa keliru. Ini teman refleksi, bukan pengganti psikolog.</div></div></aside>
        </div></section>}
      {page === 'insights' && <section className="page active-page"><div className="page-heading"><div><div className="eyebrow">MELIHAT KEMBALI</div><h1>Refleksi mingguan<span className="heading-period">.</span></h1><p className="subtitle">Pola kecil bisa bercerita banyak tentang dirimu.</p></div></div><div className="insights-grid"><div className="card insight-main"><div className="card-heading"><div><h2>Tujuh hari bersamamu</h2><p>Ringkasan dari catatan yang tersimpan.</p></div><span className="reflection-spark">✳</span></div><div className="weekly-summary">{week.map(({ date, key, count }) => <div className="week-row" key={key}><span>{new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' }).format(date)}</span><div className="week-bar"><span style={{ width: `${Math.min(100, count * 18)}%` }} /></div><strong>{count}</strong></div>)}</div></div><div className="card insight-side"><span className="snapshot-icon">♡</span><h3>Refleksi bukan penilaian</h3><p>Hari yang terasa kurang produktif tetap punya nilai. Gunakan ruang ini untuk mengenali kebutuhanmu, bukan menghakimi diri sendiri.</p><button className="button button-soft" onClick={() => setPage('journal')}>Kembali ke jurnal</button></div></div></section>}
      {page === 'profile' && <section className="page active-page"><PageHeading eyebrow="RUANG TENTANG DIRIMU" title="Tentang saya" subtitle="Ceritakan sedikit hal yang membantuku memahami duniamu." /><div className="card form-card"><FormField label="Namamu"><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Nama panggilan" /></FormField><FormField label="Hobi dan hal yang kamu sukai"><textarea rows="3" value={profile.hobbies} onChange={(event) => setProfile({ ...profile, hobbies: event.target.value })} placeholder="Misalnya: gaming, membaca, memasak…" /></FormField><FormField label="Lifestyle atau rutinitas"><textarea rows="3" value={profile.lifestyle} onChange={(event) => setProfile({ ...profile, lifestyle: event.target.value })} placeholder="Misalnya: kerja dari rumah, sedang mencoba tidur lebih awal…" /></FormField><FormField label="Hal yang ingin kamu usahakan"><textarea rows="3" value={profile.goals} onChange={(event) => setProfile({ ...profile, goals: event.target.value })} placeholder="Tujuan, kebiasaan, atau hal yang sedang kamu pikirkan…" /></FormField><div className="form-actions"><span>Profil hanya disimpan di perangkatmu.</span><button className="button button-primary" onClick={saveProfile}>Simpan profil</button></div></div></section>}
      {page === 'settings' && <section className="page active-page"><PageHeading eyebrow="PENGATURAN" title="AI pilihanmu" subtitle="Hubungkan model AI yang ingin kamu ajak bicara." /><div className="card form-card settings-card"><div className="provider-tabs">{[['openai', 'OpenAI'], ['nanogpt', 'NanoGPT'], ['gemini', 'Gemini'], ['anthropic', 'Claude'], ['custom', 'Kustom']].map(([id, label]) => <button key={id} className={`provider-tab ${prefs.provider === id ? 'selected' : ''}`} onClick={() => changeProvider(id)}>{label}</button>)}</div><FormField label={< >API key <span>Disimpan terenkripsi di perangkatmu</span></>}><div className="key-field"><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Masukkan API key" autoComplete="off" /><button onClick={() => setShowKey(!showKey)} className="text-action">{showKey ? 'Sembunyikan' : 'Tampilkan'}</button></div></FormField><FormField label="Base URL"><input value={prefs.baseUrl || ''} onChange={(event) => setPrefs({ ...prefs, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></FormField><FormField label={< >Model <span>Tuliskan ID model dari penyedia API</span></>}><input value={prefs.model || ''} onChange={(event) => setPrefs({ ...prefs, model: event.target.value })} placeholder="gpt-4o-mini" /></FormField><div className="settings-hint"><span>ⓘ</span><p>Gemini dipanggil melalui endpoint kompatibel OpenAI. Gunakan base URL dan model yang disediakan oleh penyedia API-mu. API key tidak pernah dikirim ke server Apaya.</p></div><div className="form-actions"><span>{settingsStatus}</span><div className="settings-actions"><button className="button button-soft" onClick={removeKey}>Hapus API key</button><button className="button button-primary" onClick={saveSettings}>Simpan pengaturan</button></div></div></div></section>}
      <footer className="app-footer"><span>Dibuat dengan lembut, untuk hari-harimu.</span><span>Apaya <span className="brand-dot">•</span> Data tetap di perangkatmu</span></footer>
    </main>
    {activityOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivityOpen(false) }}><dialog open className="modal"><form onSubmit={saveActivity}><div className="modal-top"><div><span className="eyebrow">JURNAL AKTIVITAS</span><h2>Apa yang kamu lakukan?</h2></div><button type="button" className="modal-close" onClick={() => setActivityOpen(false)}>×</button></div><label htmlFor="activity-time">Waktu</label><input id="activity-time" type="time" value={activityTime} onChange={(event) => setActivityTime(event.target.value)} required /><label htmlFor="activity-description">Aktivitas</label><input id="activity-description" value={activityText} onChange={(event) => setActivityText(event.target.value)} maxLength="140" placeholder="Contoh: pergi keluar bersama teman" required /><div className="modal-actions"><button type="button" className="button button-soft" onClick={() => setActivityOpen(false)}>Batal</button><button className="button button-primary" type="submit">Simpan aktivitas</button></div></form></dialog></div>}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast}</div>
  </div>
}

function NavButton({ pageName, page, onClick, icon, extraClass = '', children }) {
  return <button className={`nav-item ${page === pageName ? 'active' : ''} ${extraClass}`} onClick={() => onClick(pageName)}><span className="nav-icon">{icon}</span>{children}</button>
}

function PageHeading({ eyebrow, title, subtitle }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}<span className="heading-period">.</span></h1><p className="subtitle">{subtitle}</p></div></div>
}

function FormField({ label, children }) {
  return <div className="form-row"><label>{label}</label>{children}</div>
}

function Snapshot({ today, activities }) {
  const first = activities[0]?.time || '—'
  const last = activities.at(-1)?.time || '—'
  return <div className="card snapshot-card"><div className="snapshot-top"><span className="snapshot-icon">✳</span><span className="snapshot-tag">SEKILAS {today ? 'HARI INI' : 'HARI TERPILIH'}</span></div><h3>{!activities.length ? (today ? 'Hari yang masih terbuka' : 'Hari tanpa catatan') : activities.length < 3 ? 'Satu langkah dalam harimu' : 'Harimu punya ceritanya'}</h3><p>{!activities.length ? 'Catat aktivitasmu, dan kita bisa melihat kembali ritme harimu bersama.' : `Kamu sudah mencatat ${activities.length} aktivitas. Tidak perlu sempurna—setiap hal kecil tetap berarti.`}</p><div className="snapshot-stats"><div><strong>{activities.length}</strong><span>aktivitas</span></div><div className="stat-divider" /><div><strong>{first}</strong><span>mulai</span></div><div className="stat-divider" /><div><strong>{last}</strong><span>terakhir</span></div></div></div>
}
