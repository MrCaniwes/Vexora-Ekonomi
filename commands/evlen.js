const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ecoDb, userDb } = require('../utils/db');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evlen')
        .setDescription('Envanterinizdeki bir yüzük ile başka birine evlenme teklifi edersiniz.')
        .addUserOption(option => 
            option.setName('kisi')
                .setDescription('Evlenmek istediğiniz kişi')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const teklifEden = interaction.user ? interaction.user : interaction.author;
        const teklifEdilen = interaction.options.getUser('kisi');

        if (!teklifEdilen) return interaction.reply({ content: 'Kime evlenme teklifi edeceğini belirtmelisin!', flags: MessageFlags.Ephemeral });
        if (teklifEdilen.id === teklifEden.id) return interaction.reply({ content: 'Kendinle evlenemezsin! 😅', flags: MessageFlags.Ephemeral });
        if (teklifEdilen.bot) return interaction.reply({ content: 'Botlarla evlenemezsin, kalbimiz dijital! 🤖', flags: MessageFlags.Ephemeral });

        // Mevcut evlilik kontrolü
        const edenEvliMi = userDb.bul(`evlilik_${teklifEden.id}`);
        const edilenEvliMi = userDb.bul(`evlilik_${teklifEdilen.id}`);
        
        let yukseltmeMi = false;

        if (edenEvliMi) {
            // Eğer kendi eşine tekrar teklif ediyorsa bu bir "Yüzük Yükseltme" işlemidir
            if (edenEvliMi.partnerId === teklifEdilen.id) {
                yukseltmeMi = true;
            } else {
                return interaction.reply({ content: 'Sen zaten başkasıyla evlisin! Önce boşanmalısın.', flags: MessageFlags.Ephemeral });
            }
        } else if (edilenEvliMi) {
            return interaction.reply({ content: `<@${teklifEdilen.id}> zaten başkasıyla evli! Yuva yıkanın yuvası olmaz.`, flags: MessageFlags.Ephemeral });
        }

        // Envanterden yüzük kontrolü
        let envanter = userDb.bul(`envanter_${teklifEden.id}`) || [];
        const yuzukler = envanter.filter(e => e.kategori === 'yuzukler');

        if (yuzukler.length === 0) {
            return interaction.reply({ content: 'Evlenme teklifi etmek veya yüzük yükseltmek için envanterinde bir **Yüzük** bulunmalı! Önce `!mağaza`dan bir yüzük satın al.', flags: MessageFlags.Ephemeral });
        }

        // En iyi yüzüğü seç (fiyata göre)
        const shopPath = path.join(__dirname, '..', 'config', 'shop.json');
        const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));
        const shopYuzukleri = shopData.yuzukler;

        let enIyiYuzuk = yuzukler[0];
        let maxFiyat = 0;
        
        yuzukler.forEach(y => {
            const magazaVerisi = shopYuzukleri.find(sy => sy.id === y.id);
            if (magazaVerisi && magazaVerisi.fiyat > maxFiyat) {
                maxFiyat = magazaVerisi.fiyat;
                enIyiYuzuk = magazaVerisi;
            }
        });

        if (!enIyiYuzuk.emoji) enIyiYuzuk = shopYuzukleri.find(sy => sy.id === enIyiYuzuk.id);

        if (yukseltmeMi && edenEvliMi.yuzuk && edenEvliMi.yuzuk.fiyat >= enIyiYuzuk.fiyat) {
            return interaction.reply({ content: `Zaten **${edenEvliMi.yuzuk.isim}** takıyorsunuz. Çantanızdaki yüzük daha değerli değil!`, flags: MessageFlags.Ephemeral });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('evet')
                .setLabel('Evet! 💍')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('hayir')
                .setLabel('Hayır 💔')
                .setStyle(ButtonStyle.Danger)
        );

        let embedBaslik = '💍 Evlenme Teklifi!';
        let embedAciklama = `<@${teklifEdilen.id}>, \n**${teklifEden.username}** sana ${enIyiYuzuk.emoji} **${enIyiYuzuk.isim}** ile evlenme teklifi ediyor!\n\n*(Eğer kabul ederseniz, yüzüğün gücü sayesinde ikiniz de \`!çalış\` komutunda kalıcı **+%${enIyiYuzuk.bonusYuzdesi} Bonus** kazanacaksınız!)*\n\nKabul ediyor musun?`;
        
        if (yukseltmeMi) {
            embedBaslik = '✨ Yüzük Yükseltme!';
            embedAciklama = `<@${teklifEdilen.id}>, \nEşiniz **${teklifEden.username}**, aranızdaki bağı güçlendirmek için sana yepyeni bir ${enIyiYuzuk.emoji} **${enIyiYuzuk.isim}** hediye etmek istiyor!\n\n*(Kabul ederseniz eski yüzüğünüz atılacak ve Aşk Bonusunuz kalıcı olarak **+%${enIyiYuzuk.bonusYuzdesi}** olacak!)*\n\nKabul ediyor musun?`;
        }

        const embed = new EmbedBuilder()
            .setColor('#ff6b81')
            .setTitle(embedBaslik)
            .setDescription(embedAciklama);

        const teklifRes = await interaction.reply({ 
            content: `<@${teklifEdilen.id}>`, 
            embeds: [embed], 
            components: [row], 
            withResponse: true 
        });

        const teklifMsg = teklifRes.resource ? teklifRes.resource.message : teklifRes;
        
        const teklifSüreci = new Promise((resolve, reject) => {
            const collector = teklifMsg.createMessageComponentCollector({ time: 60000 });
            
            collector.on('collect', async i => {
                if (i.user.id !== teklifEdilen.id) {
                    return i.reply({ content: 'Bu teklif sana edilmedi!', flags: MessageFlags.Ephemeral });
                }
                
                if (i.customId === 'hayir') {
                    collector.stop('reddedildi');
                    const redMesaj = yukseltmeMi ? `💔 **${teklifEdilen.username}**, yüzük yükseltme teklifini reddetti. Eski yüzükle idare edeceksiniz!` : `💔 **${teklifEdilen.username}**, evlenme teklifini reddetti! Hayat devam ediyor...`;
                    const redEmbed = new EmbedBuilder().setColor('#e74c3c').setDescription(redMesaj);
                    await i.update({ content: null, embeds: [redEmbed], components: [] });
                    reject();
                } else if (i.customId === 'evet') {
                    collector.stop('kabul');
                    
                    // Yüzüğü teklif edenin envanterinden sil
                    envanter = envanter.filter(e => e.id !== enIyiYuzuk.id);
                    userDb.ayarla(`envanter_${teklifEden.id}`, envanter);
                    
                    const evlilikTarihi = yukseltmeMi ? edenEvliMi.tarih : Date.now();
                    const evlilikVerisiEden = { partnerId: teklifEdilen.id, yuzuk: enIyiYuzuk, tarih: evlilikTarihi };
                    const evlilikVerisiEdilen = { partnerId: teklifEden.id, yuzuk: enIyiYuzuk, tarih: evlilikTarihi };
                    
                    userDb.ayarla(`evlilik_${teklifEden.id}`, evlilikVerisiEden);
                    userDb.ayarla(`evlilik_${teklifEdilen.id}`, evlilikVerisiEdilen);

                    const kabulBaslik = yukseltmeMi ? '🎉 Yüzükler Yenilendi!' : '🎉 Gelin ve Damat!';
                    const kabulAciklama = yukseltmeMi 
                        ? `Tebrikler! <@${teklifEden.id}> ve <@${teklifEdilen.id}> çifti yüzüklerini yeniledi! 🎊\n\nArtık parmaklarında ${enIyiYuzuk.emoji} **${enIyiYuzuk.isim}** parlıyor. Maaşlarına **+%${enIyiYuzuk.bonusYuzdesi}** bonus yansıyacak!`
                        : `Tebrikler! <@${teklifEden.id}> ve <@${teklifEdilen.id}> evlendi! 🎊\n\n${enIyiYuzuk.emoji} **${enIyiYuzuk.isim}** sayesinde artık her ikisi de maaşlarına **+%${enIyiYuzuk.bonusYuzdesi}** Aşk Bonusu alacaklar!`;

                    const kabulEmbed = new EmbedBuilder()
                        .setColor('#ff6b81')
                        .setTitle(kabulBaslik)
                        .setDescription(kabulAciklama);
                        
                    await i.update({ content: null, embeds: [kabulEmbed], components: [] });
                    resolve();
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ content: `⏳ <@${teklifEdilen.id}> zamanında cevap vermediği için teklif zaman aşımına uğradı.`, embeds: [], components: [] }).catch(()=>{});
                    reject();
                }
            });
        });

        try { await teklifSüreci; } catch (err) {}
    }
};
