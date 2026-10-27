-- Coordenadas sempre dentro da imagem e tempo não negativo.
ALTER TABLE "athlete_marks" ADD CONSTRAINT "athlete_marks_valid" CHECK ("timeMs" >= 0 AND "x" >= 0 AND "x" <= 1 AND "y" >= 0 AND "y" <= 1);
