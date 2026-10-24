const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags 
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { ecoDb, userDb } = require('../utils/db');

// Seviye çarpanları ve maliyet oranları
// Level 1 -> 2: Fiyatın %60'ı, Gelir x1.75
// Level 2 -> 3: Fiyatın %120'si, Gelir x2.5
// Level 3 -> 4: Fiyatın %200'ü, Gelir x3.5
// Level 4 -> 5: Fiyatın %350'si, Gelir x5.0 (Maksimum Seviye)
const SEVIYE_TABLOSU = {
    1: { sonrakiMaliyetKatsayi: 0.6, gelirKatsayi: 1.0 },
    2: { sonrakiMaliyetKatsayi: 1.2, gelirKatsayi: 1.75 },
    3: { sonrakiMaliyetKatsayi: 2.0, gelirKatsayi: 2.5 },
    4: { sonrakiMaliyetKatsayi: 3.5, gelirKatsayi: 3.5 },
    5: { sonrakiMaliyetKatsayi: null, gelirKatsayi: 5.0 }
};

module.exports = {
    SEVIYE_TABLOSU,
    data: new SlashCommandBuilder()
        .setName('yükselt')
        .setDescription('Sahip olduğunuz işletme ve yatırımların seviyesini yükselterek gelirinizi katlayın!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        let envanter = userDb.bul(`envanter_${userId}`) || [];
        const yatirimlar = envanter.filter(e => e.kategori === 'yatirimlar');

        if (yatirimlar.length === 0) {
            return interaction.reply({ 
                content: '❌ Seviyesini yükseltebileceğiniz hiçbir işletmeniz yok! Önce `/mağaza` üzerinden bir yatırım satın almalısınız.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const shopPath = path.join(__dirname, '..', 'config', 'shop.json');
        const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

        let secilenId = yatirimlar[0].id;

        const buildContainer = (isletmeId) => {
            // Güncel envanteri veritabanından oku
            const guncelEnvanter = userDb.bul(`envanter_${userId}`) || [];
            const guncelYatirimlar = guncelEnvanter.filter(e => e.kategori === 'yatirimlar');
            const item = guncelYatirimlar.find(y => y.id === isletmeId);
            const veri = shopData.yatirimlar.find(s => s.id === isletmeId);
            if (!item || !veri) return null;

            const mevcutSeviye = item.seviye || 1;
            const tab = SEVIYE_TABLOSU[mevcutSeviye];
            const maxSeviyeMi = mevcutSeviye >= 5;

            const suankiGelir = Math.floor(veri.saatlikGelir * tab.gelirKatsayi);
            const yukseltmeBedeli = !maxSeviyeMi ? Math.floor(veri.fiyat * tab.sonrakiMaliyetKatsayi) : null;
            const sonrakiGelir = !maxSeviyeMi ? Math.floor(veri.saatlikGelir * SEVIYE_TABLOSU[mevcutSeviye + 1].gelirKatsayi) : null;

            const container = new ContainerBuilder().setAccentColor(0xf1c40f);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### 🏗️ İşletme Yükseltme & Modernizasyon\nİşletmelerinizin binalarını, altyapısını ve teknolojisini yükselterek pasif gelirinizi katlayın!`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            let detay = `🏢 **Seçili İşletme:** **${veri.isim}**\n`;
            detay += `⭐ **Mevcut Seviye:** **Level ${mevcutSeviye} / 5**\n`;
            detay += `💰 **Mevcut Kazanç:** **${suankiGelir.toLocaleString()} 🪙 / saat**\n\n`;

            if (!maxSeviyeMi) {
                detay += `🔼 **Sonraki Seviye (Level ${mevcutSeviye + 1}):**\n`;
                detay += `> 💸 **Yükseltme Bedeli:** **${yukseltmeBedeli.toLocaleString()} 🪙**\n`;
                detay += `> 📈 **Yeni Saatlik Gelir:** **${sonrakiGelir.toLocaleString()} 🪙 / saat** (+%${Math.round(((sonrakiGelir - suankiGelir) / suankiGelir) * 100)})\n`;
                detay += `> 🛡️ **Risk Oranı:** %${Math.max(1, Math.round(veri.riskOrani * 100 - (mevcutSeviye * 1)))} (Seviye arttıkça arıza ihtimali azalır)`;
            } else {
                detay += `✨ **Bu işletme maksimum seviyeye (Level 5) ulaştı! Zirvedesiniz.**`;
            }

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detay));

            // Select Menu (Kullanıcının yatırımları arasından seçim yapması için)
            const menuOptions = guncelYatirimlar.map(y => {
                const sVeri = shopData.yatirimlar.find(s => s.id === y.id);
                const sLvl = y.seviye || 1;
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${sVeri ? sVeri.isim : y.isim} (Lvl ${sLvl})`)
                    .setValue(y.id)
                    .setDescription(`Mevcut Seviye: ${sLvl}/5`)
                    .setDefault(y.id === isletmeId);
            });

            const selectMenuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('yukselt_secim')
                    .setPlaceholder('Yükseltmek istediğin işletmeyi seç...')
                    .addOptions(menuOptions)
            );

            // Buton Row (Yükseltme Butonu)
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`yukselt_yap_${isletmeId}`)
                    .setLabel(maxSeviyeMi ? 'Maksimum Seviye' : `Level ${mevcutSeviye + 1}'e Yükselt (${yukseltmeBedeli.toLocaleString()} 🪙)`)
                    .setStyle(maxSeviyeMi ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setDisabled(maxSeviyeMi)
            );

            container.addActionRowComponents(selectMenuRow);
            container.addActionRowComponents(btnRow);

            return container;
        };

        const initialContainer = buildContainer(secilenId);
        const response = await interaction.reply({ 
            components: [initialContainer], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true
        });

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({
            time: 120000
        });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: 'Bu menüyü sadece komutu başlatan kişi kullanabilir!', flags: MessageFlags.Ephemeral });
            }

            if (i.isStringSelectMenu() && i.customId === 'yukselt_secim') {
                secilenId = i.values[0];
                const cont = buildContainer(secilenId);
                await i.update({ components: [cont], flags: MessageFlags.IsComponentsV2 });
            } else if (i.isButton() && i.customId.startsWith('yukselt_yap_')) {
                const targetId = i.customId.replace('yukselt_yap_', '');
                envanter = userDb.bul(`envanter_${userId}`) || [];
                const itemIndex = envanter.findIndex(e => e.kategori === 'yatirimlar' && e.id === targetId);

                if (itemIndex === -1) {
                    return i.reply({ content: '❌ Bu işletmeye artık sahip değilsiniz!', flags: MessageFlags.Ephemeral });
                }

                const item = envanter[itemIndex];
                const veri = shopData.yatirimlar.find(s => s.id === targetId);
                const curLvl = item.seviye || 1;

                if (curLvl >= 5) {
                    return i.reply({ content: '❌ Bu işletme zaten maksimum seviyede!', flags: MessageFlags.Ephemeral });
                }

                const maliyet = Math.floor(veri.fiyat * SEVIYE_TABLOSU[curLvl].sonrakiMaliyetKatsayi);
                const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;

                if (cuzdan < maliyet) {
                    return i.reply({ 
                        content: `❌ Yetersiz bakiye! Bu yükseltme için **${maliyet.toLocaleString()} 🪙** gerekiyor. (Cüzdanın: **${cuzdan.toLocaleString()} 🪙**)`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                // Parayı düş
                ecoDb.cikar(`cuzdan_${userId}`, maliyet);

                // Seviyeyi güncelle
                item.seviye = curLvl + 1;
                envanter[itemIndex] = item;
                userDb.ayarla(`envanter_${userId}`, envanter);

                // Arayüzü yenile
                const updatedCont = buildContainer(targetId);
                await i.update({ components: [updatedCont], flags: MessageFlags.IsComponentsV2 });

                await interaction.followUp({ 
                    content: `🎉 Tebrikler! **${veri.isim}** başarıyla **Level ${item.seviye}** seviyesine yükseltildi! (-${maliyet.toLocaleString()} 🪙)`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
        });
    }
};
