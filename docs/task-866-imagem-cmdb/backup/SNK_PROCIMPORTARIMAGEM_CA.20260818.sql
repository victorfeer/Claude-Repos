-- ============================================================================
-- BACKUP da procedure SNK_PROCIMPORTARIMAGEM_CA
-- Capturado em: 2026-08-18 (ANTES da alteração da TASK 866)
-- Origem: fonte atual em produção/HML (extraído via ALL_SOURCE)
-- Uso: rollback — recriar esta versão em caso de problema com a atualização.
-- NÃO EDITAR este arquivo. É a fotografia do estado anterior.
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

            from AD_IMPORTAIMAGEM img
            where
             EXISTS (SELECT 1 FROM AD_PLANEIMAGEM GEM WHERE GEM.CODIMG = img.imagem  AND (((CASE WHEN GEM.ATIVO = 'S' THEN 0 ELSE 1 END) <> IMG.status) OR (GEM.CODPARC <> img.codparc)))

        );


BEGIN


      FOR R1 IN C1 LOOP


         SELECT NVL(MAX(SEQ),0) +1 INTO P_SEQ  FROM AD_PLANEIMAGEM;

         INSERT INTO AD_PLANEIMAGEM (SEQ, CODIMG, PERFIL, CODPARC, DTCRIACAO, ATIVO, IDIMAGEMCA)
         VALUES(P_SEQ, R1.IMAGEM, R1.PERFIL_IMAGEM, R1.CODPARC, TO_DATE(R1.DATA_CRIACAO),'S', R1.IDIMAGEMCA);

      END LOOP;


      FOR R2 IN C2 LOOP
         UPDATE AD_PLANEIMAGEM SET ATIVO = (CASE WHEN R2.ATIVO = 0 THEN 'S' ELSE 'N' END), DHALTER = SYSDATE , IDIMAGEMCA = R2.IDIMAGEMCA, CODPARC = R2.CODPARC
         WHERE CODIMG = R2.IMAGEM;

      END LOOP;


END;
/
