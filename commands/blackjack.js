const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} = require('discord.js');
const { ecoDb } = require('../utils/db');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');

// Kartları ve değerlerini tanımla
const desteyiOlustur = () => {
    const suit = ['♠', '♥', '♦', '♣'];
    const degerler = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deste = [];
    for (let s of suit) {
        for (let d of degerler) {
            let puan = parseInt(d);
            if (['J', 'Q', 'K'].includes(d)) puan = 10;
            if (d === 'A') puan = 11;
            deste.push({ isim: `${d}${s}`, puan, isAce: d === 'A' });
        }
    }
    // Desteyi karıştır
    return deste.sort(() => Math.random() - 0.5);
};

const puanHesapla = (kartlar) => {
    let toplam = 0;
    let asSayisi = 0;
    for (let k of kartlar) {
        toplam += k.puan;
        if (k.isAce) asSayisi++;
    }
    while (toplam > 21 && asSayisi > 0) {
        toplam -= 10;
        asSayisi--;
    }
    return toplam;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('21')
        .setDescription('Kurpiyere karşı Blackjack (21) oynayın!')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Ortaya koymak istediğiniz miktar (Nakit)')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        const bahis = interaction.options.getInteger('bahis');

        if (bahis <= 0) return interaction.reply({ content: 'Bahis miktarı 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        // Bahsi düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        let deste = desteyiOlustur();
        let oyuncuKartlari = [deste.pop(), deste.pop()];
        let botKartlari = [deste.pop(), deste.pop()];
        let durum = 'devam'; // 'devam', 'kazandi', 'kaybetti', 'berabere', 'blackjack'
        let aciklamaMesaji = '';

        // Başlangıçta Blackjack kontrolü
        if (puanHesapla(oyuncuKartlari) === 21) {
            durum = 'blackjack';
            const bjKazanc = Math.floor(bahis * 2.5);
            aciklamaMesaji = `🎰 **Blackjack!** (+${bjKazanc.toLocaleString()} 🪙)`;
            ecoDb.ekle(`cuzdan_${userId}`, bjKazanc);
            const { canliDurumBildir } = require('../utils/canliDurum');
            canliDurumBildir({ userId, oyunAdi: 'Blackjack', bahis, kazanc: bjKazanc, carpan: 2.5, kaynak: 'discord' });
        } else if (puanHesapla(botKartlari) === 21) {
            durum = 'kaybetti';
            aciklamaMesaji = `❌ **Kurpiyer Blackjack yaptı!** (-${bahis.toLocaleString()} 🪙)`;
        }

        const generateContainer = () => {
            const container = new ContainerBuilder().setAccentColor(durum === 'devam' ? 0x9b59b6 : (['kazandi', 'blackjack'].includes(durum) ? 0x2ecc71 : (durum === 'kaybetti' ? 0xe74c3c : 0xf1c40f)));

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('### 🃏 Blackjack (21)')
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            let botKartStr = '';
            let botPuan = '?';

            if (durum === 'devam') {
                // İlk kart açık, ikinci kart kapalı
                botKartStr = `**${botKartlari[0].isim}** | 🎴`;
                botPuan = botKartlari[0].puan;
            } else {
                botKartStr = botKartlari.map(k => `**${k.isim}**`).join(' | ');
                botPuan = puanHesapla(botKartlari);
            }

            const oyuncuKartStr = oyuncuKartlari.map(k => `**${k.isim}**`).join(' | ');
            const oyuncuPuan = puanHesapla(oyuncuKartlari);

            let icerik = `🪙 **Bahis:** ${bahis.toLocaleString()}\n\n`;
            icerik += `👔 **Kurpiyer:** ${botKartStr}\n> Skor: **${botPuan}**\n\n`;
            icerik += `👤 **Sen:** ${oyuncuKartStr}\n> Skor: **${oyuncuPuan}**`;

            if (durum !== 'devam') {
                icerik += `\n\n${aciklamaMesaji}`;
                const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
                icerik += `\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;
            }

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(icerik));

            if (durum === 'devam') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('hit').setLabel('Kart Çek').setEmoji('👆').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('stand').setLabel('Bekle').setEmoji('🛑').setStyle(ButtonStyle.Danger)
                );
                container.addActionRowComponents(row);
            }

            return container;
        };

        const response = await interaction.reply({ 
            components: [generateContainer()], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });

        if (durum !== 'devam') return; // Oyun en başta bittiyse (Blackjack) collector açmaya gerek yok.

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu oyunu sadece başlatan kişi oynayabilir!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'hit') {
                // Dua / Lanet Etkisi ile Kart Çekme
                const kaderPuani = getKaderPuani(userId);
                const kaderSansFaktoru = Math.abs(kaderPuani) * PUAN_BASINA_SANS;
                const suankiPuan = puanHesapla(oyuncuKartlari);

                let cekilecekKart = deste.pop();

                // Eğer oyuncu kritik noktadaysa (12-16 puan) ve dua puanı varsa:
                if (kaderPuani > 0 && suankiPuan >= 12 && suankiPuan <= 16 && Math.random() < kaderSansFaktoru) {
                    // Patlatacak bir kart çekildiyse, desteden patlatmayacak küçük bir kart ara
                    if (suankiPuan + cekilecekKart.puan > 21) {
                        const guvenliIndex = deste.findIndex(k => suankiPuan + k.puan <= 21);
                        if (guvenliIndex !== -1) {
                            deste.push(cekilecekKart); // Eski kartı desteye geri koy
                            cekilecekKart = deste.splice(guvenliIndex, 1)[0];
                        }
                    }
                } 
                // Eğer oyuncu lanetliyse ve dua/şansı yoksa:
                else if (kaderPuani < 0 && suankiPuan >= 12 && suankiPuan <= 16 && Math.random() < kaderSansFaktoru) {
                    // Desteden patlatacak bir kart ara
                    const patlatanIndex = deste.findIndex(k => suankiPuan + k.puan > 21);
                    if (patlatanIndex !== -1) {
                        deste.push(cekilecekKart);
                        cekilecekKart = deste.splice(patlatanIndex, 1)[0];
                    }
                }

                oyuncuKartlari.push(cekilecekKart);
                const puan = puanHesapla(oyuncuKartlari);

                if (puan > 21) {
                    durum = 'kaybetti';
                    aciklamaMesaji = `❌ **Patladın!** (-${bahis.toLocaleString()} 🪙)`;
                    collector.stop();
                } else if (puan === 21) {
                    // Otomatik Stand say
                    i.customId = 'stand';
                }
            }

            if (i.customId === 'stand') {
                let botPuan = puanHesapla(botKartlari);
                
                // Bot 17 olana kadar zorunlu kart çeker
                while (botPuan < 17) {
                    botKartlari.push(deste.pop());
                    botPuan = puanHesapla(botKartlari);
                }

                // --- OYUNCU KIYAĞI (Kurpiyeri biraz şapşal yapıyoruz) ---
                if (botPuan >= 17 && botPuan <= 20 && Math.random() < 0.25) {
                    botKartlari.push(deste.pop());
                    botPuan = puanHesapla(botKartlari);
                }
                // --------------------------------------------------------

                const oyuncuPuan = puanHesapla(oyuncuKartlari);

                if (botPuan > 21) {
                    durum = 'kazandi';
                    aciklamaMesaji = `🎉 **Kurpiyer patladı, Kazandın!** (+${(bahis * 2).toLocaleString()} 🪙)`;
                    ecoDb.ekle(`cuzdan_${userId}`, bahis * 2);
                    const { canliDurumBildir } = require('../utils/canliDurum');
                    canliDurumBildir({ userId, oyunAdi: 'Blackjack', bahis, kazanc: bahis * 2, carpan: 2, kaynak: 'discord' });
                } else if (oyuncuPuan > botPuan) {
                    durum = 'kazandi';
                    aciklamaMesaji = `🎉 **Kazandın!** (+${(bahis * 2).toLocaleString()} 🪙)`;
                    ecoDb.ekle(`cuzdan_${userId}`, bahis * 2);
                    const { canliDurumBildir } = require('../utils/canliDurum');
                    canliDurumBildir({ userId, oyunAdi: 'Blackjack', bahis, kazanc: bahis * 2, carpan: 2, kaynak: 'discord' });
                } else if (oyuncuPuan < botPuan) {
                    durum = 'kaybetti';
                    aciklamaMesaji = `❌ **Kaybettin!** (-${bahis.toLocaleString()} 🪙)`;
                    const bjRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
                    if (bjRemBal === 0) {
                        const { canliDurumIflasBildir } = require('../utils/canliDurum');
                        canliDurumIflasBildir({ userId, oyunAdi: 'Blackjack', kaybedilenBahis: bahis, kaynak: 'discord' });
                    }
                } else {
                    durum = 'berabere';
                    aciklamaMesaji = `🤝 **Berabere!** (İade: +${bahis.toLocaleString()} 🪙)`;
                    ecoDb.ekle(`cuzdan_${userId}`, bahis);
                }
                collector.stop();
            }

            await i.update({ components: [generateContainer()], flags: MessageFlags.IsComponentsV2 });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                ecoDb.ekle(`cuzdan_${userId}`, bahis);
                interaction.editReply({ 
                    content: '⏱️ Süre doldu, oyun iptal edildi. Paranız cüzdanınıza iade edildi.',
                    components: [],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        });
    },
};
