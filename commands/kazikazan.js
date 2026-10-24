const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const { ecoDb, userDb } = require('../utils/db');
const { successEmbed, warningEmbed, errorEmbed } = require('../utils/embedUtils');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');

const ODULLER = {
    '🍒': { carpan: 2, isim: 'Kiraz' },
    '🍇': { carpan: 3, isim: 'Üzüm' },
    '🍋': { carpan: 5, isim: 'Limon' },
    '🍉': { carpan: 10, isim: 'Karpuz' },
    '💎': { carpan: 25, isim: 'Elmas' }
};
const SYMBOLS = ['🍒', '🍇', '🍋', '🍉', '💎'];

function dondurKalanlari(kalanSayi, haric) {
    let pool = [];
    let counts = { '🍒': 0, '🍇': 0, '🍋': 0, '🍉': 0, '💎': 0 };
    if (haric) counts[haric] = 3; 
    
    for(let i = 0; i < kalanSayi; i++) {
        let available = SYMBOLS.filter(s => counts[s] < 2);
        let secilen = available[Math.floor(Math.random() * available.length)];
        counts[secilen]++;
        pool.push(secilen);
    }
    return pool;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kazı-kazan')
        .setDescription('İstediğiniz miktarda bahis koyarak kazı kazan oynarsınız. 3 aynı sembolü bul, ödülü kap!')
        .addIntegerOption(option => 
            option.setName('miktar')
                .setDescription('Bilet için yatırmak istediğiniz bahis miktarı')
                .setRequired(true)
                .setMinValue(10)
        ),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        
        let BEDEL = interaction.options.getInteger('miktar');
        
        // Eğer prefix komutundan geliyorsa (metin tabanlı argüman)
        if (!BEDEL && interaction.options.getString('miktar')) {
            BEDEL = parseInt(interaction.options.getString('miktar'));
        }

        if (!BEDEL || isNaN(BEDEL) || BEDEL < 10) {
            return interaction.reply({ content: '❌ Lütfen geçerli bir bilet tutarı girin! (Minimum 10 🪙)', ephemeral: true });
        }

        if (bakiye < BEDEL) {
            return interaction.reply({ embeds: [errorEmbed(interaction.member, 'Yetersiz Bakiye', `Kazı kazan bileti almak için **${BEDEL.toLocaleString()} 🪙** gerekiyor. Sende **${bakiye.toLocaleString()} 🪙** var.`)], ephemeral: true });
        }

        // Parayı kes
        ecoDb.cikar(`cuzdan_${userId}`, BEDEL);

        // Sonucu belirle (RTP Hesaplaması ile)
        const rand = Math.random();
        let kazananSembol = null;

        // 🤫 Hile Kontrolü (Sadece eğer admin ayarladıysa devreye girer)
        const hile = userDb.bul(`hileli_kazi_${userId}`);
        
        if (hile) {
            if (hile === 'kayip') kazananSembol = null;
            else kazananSembol = hile;
            
            // Hileyi tek seferlik kullanıp siliyoruz
            userDb.sil(`hileli_kazi_${userId}`);
        } 
        else {
            // Dua / Lanet Kader Etkisi (Her puan için ±%2 toplam kazanma şansı etkisi)
            const kaderPuani = getKaderPuani(userId);
            const sansKaymasi = kaderPuani * PUAN_BASINA_SANS; // Örn: +2 puan -> +0.04 (%4)

            // Temel eşikler: 0.005 (Elmas), 0.015 (Karpuz), 0.055 (Limon), 0.135 (Üzüm), 0.285 (Kiraz)
            // Dua edende kiraz/üzüm/limon aralığı genişler; lanetlide daralır.
            const kirazSiniri = Math.min(0.60, Math.max(0.10, 0.285 + sansKaymasi));
            const uzumSiniri = Math.min(0.35, Math.max(0.05, 0.135 + (sansKaymasi * 0.6)));
            const limonSiniri = Math.min(0.15, Math.max(0.02, 0.055 + (sansKaymasi * 0.3)));
            const karpuzSiniri = Math.min(0.04, Math.max(0.005, 0.015 + (sansKaymasi * 0.1)));
            const elmasSiniri = Math.min(0.015, Math.max(0.002, 0.005 + (sansKaymasi * 0.05)));

            // Normal Şans Oranları
            if (rand < elmasSiniri) kazananSembol = '💎';
            else if (rand < karpuzSiniri) kazananSembol = '🍉';
            else if (rand < limonSiniri) kazananSembol = '🍋';
            else if (rand < uzumSiniri) kazananSembol = '🍇';
            else if (rand < kirazSiniri) kazananSembol = '🍒';
            else kazananSembol = null; // Kayıp
        }

        // Kartı Oluştur
        let board = [];
        if (kazananSembol) {
            board.push(kazananSembol, kazananSembol, kazananSembol);
            board = board.concat(dondurKalanlari(6, kazananSembol));
        } else {
            board = dondurKalanlari(9, null);
        }

        // Tahtayı Karıştır
        board = board.sort(() => Math.random() - 0.5);

        // UI Oluşturucu
        const revealed = new Set();
        let gameOver = false;
        
        const generateComponents = (ekIcerik = '') => {
            const container = new ContainerBuilder().setAccentColor(0x2ecc71);
            
            let ustMetin = `### 🎫 VEXORA KAZI KAZAN\n**Bilet Fiyatı:** ${BEDEL.toLocaleString()} 🪙\n\n*Kartını kazımaya başla! 3 aynı sembolü bulursan kazanırsın!*\n> (Ödüller: 🍒x2 | 🍇x3 | 🍋x5 | 🍉x10 | 💎x25)\n`;
            
            if (ekIcerik) {
                const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
                ustMetin += `\n${ekIcerik}\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;
            }

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ustMetin));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const idx = i * 3 + j;
                    const isRevealed = revealed.has(idx) || gameOver;
                    const btn = new ButtonBuilder()
                        .setCustomId(`kazi_${idx}`)
                        .setStyle(isRevealed ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(isRevealed);
                        
                    if (isRevealed) {
                        btn.setEmoji(board[idx]);
                    } else {
                        btn.setLabel('❓');
                    }
                    row.addComponents(btn);
                }
                container.addActionRowComponents(row);
            }

            // 4. Satır Hepsini Kazı butonu
            if (!gameOver) {
                container.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('hepsini_kazi').setLabel('🎫 Hepsini Kazı').setStyle(ButtonStyle.Success)
                ));
            }
            
            return container;
        };

        const anaMesaj = await interaction.reply({ 
            components: [generateComponents()],
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });

        const mesajObjesi = anaMesaj.resource ? anaMesaj.resource.message : anaMesaj;
        const collector = mesajObjesi.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: 'Bu senin biletin değil! Kendine bir bilet al.', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'hepsini_kazi') {
                for (let idx = 0; idx < 9; idx++) revealed.add(idx);
            } else {
                const idx = parseInt(i.customId.split('_')[1]);
                revealed.add(idx);
            }

            // Kazanma durumu kontrolü
            const counts = {};
            let kazandiMi = false;
            let bulunanSembol = null;

            revealed.forEach(idx => {
                const s = board[idx];
                counts[s] = (counts[s] || 0) + 1;
                if (counts[s] === 3) {
                    kazandiMi = true;
                    bulunanSembol = s;
                }
            });

            if (kazandiMi) {
                gameOver = true;
                const container = generateComponents(`🎉 **TEBRİKLER!** 3 tane **${bulunanSembol} (${ODULLER[bulunanSembol].isim})** buldun ve **${(BEDEL * ODULLER[bulunanSembol].carpan).toLocaleString()} 🪙** kazandın!`);
                container.setAccentColor(0xf1c40f); // Altın Sarısı
                
                // Kazanan sembolleri yeşil yap
                revealed.forEach(idx => {
                    if (board[idx] === bulunanSembol) {
                        const rowIndex = Math.floor(idx / 3);
                        const colIndex = idx % 3;
                        // Container'da satırlar separator ve textten sonra gelir
                        container.components[rowIndex + 2].components[colIndex].setStyle(ButtonStyle.Success);
                    }
                });

                const odul = BEDEL * ODULLER[bulunanSembol].carpan;
                ecoDb.ekle(`cuzdan_${userId}`, odul);
                const { canliDurumBildir } = require('../utils/canliDurum');
                canliDurumBildir({ userId, oyunAdi: 'Kazı Kazan', bahis: BEDEL, kazanc: odul, carpan: ODULLER[bulunanSembol].carpan, kaynak: 'discord' });

                await i.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
                return collector.stop();
            }

            // Bütün tahta açıldıysa ve kazanılamadıysa
            if (revealed.size === 9 && !kazandiMi) {
                gameOver = true;
                const container = generateComponents(`😢 **KAYBETTİN!** Maalesef amorti bile vurmadı. Kart çöpe gitti.`);
                container.setAccentColor(0xe74c3c); // Kırmızı
                
                // Hepsini kırmızı yap
                for (let i = 0; i < 3; i++) {
                    container.components[i + 2].components.forEach(btn => btn.setStyle(ButtonStyle.Danger));
                }

                await i.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
                return collector.stop();
            }

            // Oyun devam ediyor
            await i.update({ components: [generateComponents()], flags: MessageFlags.IsComponentsV2 });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !gameOver) {
                interaction.editReply({ content: '⏳ Süren doldu, kazı kazan kartın yırtıldı!', components: [] }).catch(()=>{});
            }
        });
    }
};
