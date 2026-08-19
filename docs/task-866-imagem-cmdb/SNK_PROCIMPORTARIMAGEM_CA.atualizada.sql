-- ============================================================================
-- SNK_PROCIMPORTARIMAGEM_CA — versão ATUALIZADA (TASK 866)
-- Data: 2026-08-18
-- Backup do fonte anterior: backup/SNK_PROCIMPORTARIMAGEM_CA.20260818.sql
--
-- DECISÃO: os campos ORIGEM, IDVOKENEX e DHINTEGRACAO existem apenas na
-- AD_IMPORTAIMAGEM (staging). A AD_PLANEIMAGEM NÃO recebe esses campos —
-- a rastreabilidade até o staging se faz pelo IDIMAGEMCA (já propagado).
--
-- O QUE MUDOU em relação ao backup:
--   - Após promover cada linha (INSERT em C1 / UPDATE em C2), grava
--     AD_IMPORTAIMAGEM.DHINTEGRACAO = SYSDATE (marca de integrado / auditoria).
--   - NADA muda no INSERT/UPDATE da AD_PLANEIMAGEM (sem novas colunas lá).
--
-- Regras preservadas do original:
--   - Deduplicação por CODIMG (= IMAGEM).
--   - Sem COMMIT interno: quem chama controla a transação. Se der erro e houver
--     rollback, o DHINTEGRACAO não persiste → casa com "se falhar, não marcar
--     como integrado e reenviar".
--
-- OBS.: ORIGEM/IDVOKENEX são consumidos pela integração de ENTRADA (Run2Biz →
-- staging) e ficam disponíveis para consulta/rastreio no próprio staging. Se no
-- futuro quiser vê-los também na AD_PLANEIMAGEM, criar as 2 colunas lá e
-- descomentar os trechos "-- 866-opc" abaixo.
-- ============================================================================

CREATE OR REPLACE PROCEDURE snk_procimportarimagem_ca
AS

   P_SEQ INT;

      CURSOR C1 IS

      (

              SELECT
              img.idimagemca AS IDIMAGEMCA,
              img.imagem AS IMAGEM,
              img.perfilimagem AS PERFIL_IMAGEM,
              To_Number(img.codparc) AS CODPARC,
              to_char(to_date('30.12.1969 21','dd.mm.yyyy HH24:mi:ss') + (img.datacriacao/ (86400)),'dd/mm/yyyy') AS DATA_CRIACAO
              --, img.origem AS ORIGEM, img.idvokenex AS IDVOKENEX   -- 866-opc
              from AD_IMPORTAIMAGEM img
              where img.status = 0
              and NOT EXISTS (SELECT 1 FROM AD_PLANEIMAGEM GEM WHERE GEM.CODIMG = img.imagem)

        );

        CURSOR C2 IS
        (
            SELECT
            img.idimagemca AS IDIMAGEMCA,
              img.imagem AS IMAGEM,
              img.perfilimagem AS PERFIL_IMAGEM,
              To_Number(img.codparc) AS CODPARC,
              to_char(to_date('30.12.1969 21','dd.mm.yyyy HH24:mi:ss') + (img.datacriacao/ (86400)),'dd/mm/yyyy') AS DATA_CRIACAO,
              img.status AS ATIVO
              --, img.origem AS ORIGEM, img.idvokenex AS IDVOKENEX   -- 866-opc

            from AD_IMPORTAIMAGEM img
            where
             EXISTS (SELECT 1 FROM AD_PLANEIMAGEM GEM WHERE GEM.CODIMG = img.imagem  AND (((CASE WHEN GEM.ATIVO = 'S' THEN 0 ELSE 1 END) <> IMG.status) OR (GEM.CODPARC <> img.codparc)))

        );


BEGIN


      FOR R1 IN C1 LOOP


         SELECT NVL(MAX(SEQ),0) +1 INTO P_SEQ  FROM AD_PLANEIMAGEM;

         INSERT INTO AD_PLANEIMAGEM (SEQ, CODIMG, PERFIL, CODPARC, DTCRIACAO, ATIVO, IDIMAGEMCA)
         VALUES(P_SEQ, R1.IMAGEM, R1.PERFIL_IMAGEM, R1.CODPARC, TO_DATE(R1.DATA_CRIACAO),'S', R1.IDIMAGEMCA);
         -- 866-opc: INSERT com origem/idvokenex (só se criar as colunas em AD_PLANEIMAGEM)
         -- INSERT INTO AD_PLANEIMAGEM (SEQ, CODIMG, PERFIL, CODPARC, DTCRIACAO, ATIVO, IDIMAGEMCA, ORIGEM, IDVOKENEX)
         -- VALUES(P_SEQ, R1.IMAGEM, R1.PERFIL_IMAGEM, R1.CODPARC, TO_DATE(R1.DATA_CRIACAO),'S', R1.IDIMAGEMCA, R1.ORIGEM, R1.IDVOKENEX);

         -- 866: marca a linha de staging como integrada (auditoria da promoção)
         UPDATE AD_IMPORTAIMAGEM SET DHINTEGRACAO = SYSDATE WHERE idimagemca = R1.IDIMAGEMCA;

      END LOOP;


      FOR R2 IN C2 LOOP
         UPDATE AD_PLANEIMAGEM SET ATIVO = (CASE WHEN R2.ATIVO = 0 THEN 'S' ELSE 'N' END), DHALTER = SYSDATE , IDIMAGEMCA = R2.IDIMAGEMCA, CODPARC = R2.CODPARC
         --, ORIGEM = R2.ORIGEM, IDVOKENEX = R2.IDVOKENEX   -- 866-opc
         WHERE CODIMG = R2.IMAGEM;

         -- 866: marca a linha de staging como integrada (auditoria da promoção)
         UPDATE AD_IMPORTAIMAGEM SET DHINTEGRACAO = SYSDATE WHERE idimagemca = R2.IDIMAGEMCA;

      END LOOP;


END;
/
