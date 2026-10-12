-- Dados iniciais: os 5 clientes e os 25 leads da semana 1 (contatos levantados em 12/10/2026).
insert into clients (nome, segmento, cidade, plataforma) values
  ('Invertech Palmas', 'Climatização', 'Palmas-TO', 'google'),
  ('Dra. Josimara Lima', 'Advocacia previdenciária', 'Araripina-PE', 'google'),
  ('Matheus Morari', 'Psicologia', null, 'google'),
  ('Style Store For Men', 'Loja de roupas', null, 'meta'),
  ('Delegada Gleide Angelo', 'Política', null, 'meta');

insert into leads (ordem, nome, cidade, nicho, endereco, whatsapp, whatsapp_confirmado, instagram) values
  (1, 'Bom Frio Refrigeração', 'Teresina', 'clima', 'R. Ivan Tito de Oliveira, 1185, Lourival Parente', '5586981582747', true, 'bom_frio_refrige'),
  (2, '3E Refrigeração', 'Teresina', 'clima', 'R. Francisco Nunes da Rocha, 2877, Santa Maria', '5586999012554', true, null),
  (3, 'Parque Sul Refrigeração', 'Teresina', 'clima', 'R. Dr. Airton Freitas, 13, Santo Antônio', '5586988066624', true, null),
  (4, 'EGS Ar-condicionado', 'Teresina', 'clima', null, '5586988522973', true, null),
  (5, 'Classe A Climatização', 'Teresina', 'clima', 'Av. Presidente Kennedy, 7, São Cristóvão', '5586995741646', true, null),
  (6, 'Tocantins Climatização', 'Araguaína', 'clima', null, '5563992391027', true, 'tocantins_climatizacao'),
  (7, 'Servitec Climatização', 'Teresina', 'clima', 'Residencial Zilda Arns, Nova Brasília', '5586999546537', false, null),
  (8, 'Split Clean Refrigeração', 'Teresina', 'clima', 'Av. Gonçalves Dias, 2402, Morada Nova', '5586998502121', false, null),
  (9, 'K Moura Climatização', 'Teresina', 'clima', null, '5586988096979', false, null),
  (10, 'Marinho Refrigeração', 'Araguaína', 'clima', 'Av. Guanabara, 148, Setor Carajá', '5563984240785', false, null),
  (11, 'Glaubert Felix Oliveira Advocacia Previdenciária', 'Guaraí', 'adv', 'Av. Goiás, 1322, Centro', '5563992921038', true, null),
  (12, 'ELS Cordeiro Advogada', 'Serra Talhada', 'adv', null, '5587999971219', true, null),
  (13, 'Rafael Ramos Advocacia', 'Salgueiro', 'adv', 'Salgueiro Shopping, 1º andar', '5587996454040', true, null),
  (14, 'Juliana Roriz Advocacia', 'Petrolina', 'adv', null, '5587974006321', false, null),
  (15, 'Ingrid Alencar Advocacia', 'Serra Talhada', 'adv', null, '5587999400264', false, null),
  (16, 'AR Advocacia (Aristelia Rodrigues)', 'Gurupi', 'adv', 'Alameda Madrid, 191', null, false, 'adv.aristeliarodrigues'),
  (17, 'NEO Especialidades Odontológicas', 'Igarassu', 'odonto', 'Av. Mário Melo, Centro', '5581994529225', true, 'neoigarassu'),
  (18, 'LDB Odontologia', 'Igarassu', 'odonto', 'R. Santina Gomes de Andrade, 04, Centro', '5581984284252', false, 'ldbodontologia'),
  (19, 'Vitória Delgado Odontologia e Harmonização', 'Igarassu', 'odonto', null, '5581994284750', true, null),
  (20, 'Visage Odontologia', 'Paulista', 'odonto', 'Janga', '5581971163005', true, 'consultoriosvisage'),
  (21, 'Saudental Centro Odontológico', 'Paulista', 'odonto', 'Centro', '5581991428730', true, 'saudental_paulista'),
  (22, 'COP Centro Odontológico de Paulista', 'Paulista', 'odonto', 'R. Milton Souza Lopes, 213', '5581988651951', true, 'cop.centro_odontologico'),
  (23, 'Clínica Odontovieira', 'Paulista', 'odonto', 'R. Cinquenta e Um, 35, Jardim Paulista', '5581985764378', true, 'clinicaodontovieira'),
  (24, 'Kaly Odontologia', 'Paulista', 'odonto', 'Jardim Paulista', '5581996927089', true, null),
  (25, 'Max Sorriso Saúde e Estética Oral', 'Paulista', 'odonto', 'R. Cidade Universitária, 160, Janga', '5581985342919', false, null);
