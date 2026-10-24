const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { ecoDb, userDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zenginler')
        .setDescription('Sunucunun en zengin oyuncularını listeler.'),
        
    async execute(interaction) {
        // Tüm veritabanını tek seferde çekiyoruz (Performans için)
        const economyData = ecoDb.readDB();
        const userData = userDb.readDB();
        const piyasa = economyData['borsa_piyasa'] || {};

        const oyuncular = [];

        for (const key in economyData) {
            if (key.startsWith('cuzdan_')) {
                const userId = key.split('_')[1];
                const bakiye = economyData[key] || 0;
                
                // Borsa yatırım hacmini hesapla
                let borsaDegeri = 0;
                const portfoy = userData[`portfoy_${userId}`];
                if (portfoy) {
                    for (const varlikId in portfoy) {
                        let veri = portfoy[varlikId];
                        if (!veri) continue;
                        
                        let adet = typeof veri === 'number' ? veri : veri.adet;
                        if (adet > 0 && piyasa[varlikId]) {
                            borsaDegeri += adet * piyasa[varlikId].fiyat;
                        }
                    }
                }

                const toplamServet = bakiye + borsaDegeri;

                // Sadece sıfırdan büyük parası olanları listeye al
                if (toplamServet > 0) {
                    oyuncular.push({
                        userId: userId,
                        bakiye: bakiye,
                        borsa: Math.floor(borsaDegeri),
                        servet: Math.floor(toplamServet)
                    });
                }
            }
        }

        // Toplam servete göre büyükten küçüğe sırala
        oyuncular.sort((a, b) => b.servet - a.servet);

        // İlk 10 kişiyi al
        const top10 = oyuncular.slice(0, 10);

        if (top10.length === 0) {
            return interaction.reply({ content: 'Henüz sunucuda parası olan hiç kimse yok!', flags: MessageFlags.Ephemeral });
        }

        const container = new ContainerBuilder().setAccentColor(0xf1c40f);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 🏆 Sunucunun En Zengin 10 Kişisi\nSunucudaki en yüksek **Net Servete** (Nakit + Borsa) sahip oyuncular listesi.')
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        let siralamaMetni = '';
        const madalyalar = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < top10.length; i++) {
            const oyuncu = top10[i];
            const rozet = i < 3 ? madalyalar[i] : `**#${i + 1}**`;
            
            // Etiketleme yapmamak için kullanıcının ismini (username) API'den çekiyoruz
            let kullaniciAdi = 'Bilinmeyen Oyuncu';
            try {
                const user = await interaction.client.users.fetch(oyuncu.userId);
                kullaniciAdi = user ? user.username : 'Bilinmeyen Oyuncu';
            } catch (error) {}

            siralamaMetni += `${rozet} **${kullaniciAdi}**\n> 💎 **Net Servet:** ${oyuncu.servet.toLocaleString()} 🪙\n> *(Nakit: ${oyuncu.bakiye.toLocaleString()} | Borsa: ${oyuncu.borsa.toLocaleString()})*\n\n`;
        }

        // Eğer kullanıcı ilk 10'da değilse sırasını bulup alta ekleyelim
        const kullaniciSirasi = oyuncular.findIndex(o => o.userId === interaction.user.id);
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(siralamaMetni)
        );

        if (kullaniciSirasi >= 10) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`*Senin Sıralaman: **#${kullaniciSirasi + 1}** (${oyuncular[kullaniciSirasi].servet.toLocaleString()} 🪙)*`)
            );
        }

        await interaction.reply({ 
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },
};
