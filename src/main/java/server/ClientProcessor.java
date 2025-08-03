package server;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class ClientProcessor implements Runnable {

    private Socket sock;
    private ObjectInputStream in = null;
    private ObjectOutputStream out = null;
    private Connection connection;
    public static int currentnumJoueur = 0;
    public static int currentEquipe =1;
    public static int currentPartie =1;
    public static boolean callDone = false;
    public static int nbCartesChien = 1;
    public static int currentPlis =1;
    public static boolean dogDone = false;
    public static boolean cardsDealt = false;
    public static int currentJoueurTour = -1;
    public static int countJoueurTour = 1;
    public static int countNbTour = 1;
     public static  String couleurAppel = null;
    public static boolean finPartie = false;
    public static boolean finTour = false;
    public static String couleurTour = "";
    public static int firstPlayer = 1;
    public static int plisCount = 0;
    public static int lastExcusePlayer = -1;
    public static double lastExcusePoints = 0;

    private static final CopyOnWriteArrayList<ObjectOutputStream> listeners = new CopyOnWriteArrayList<>();




    public ClientProcessor(Socket pSock) throws SQLException, ClassNotFoundException {
        MySQLConnection db = MySQLConnection.fromEnv();
        this.connection = db.getConnection();
        sock = pSock;
    }

    public void sendAsync(List<Object> message) {
        try {
            synchronized (out) {
                out.writeObject(message);
                out.flush();
            }
        } catch (IOException e) {
            listeners.remove(out);
        }
    }

    public static void broadcast(List<Object> message) {
        for (ObjectOutputStream o : listeners) {
            try {
                synchronized (o) {
                    o.writeObject(message);
                    o.flush();
                }
            } catch (IOException e) {
                listeners.remove(o);
            }
        }
    }

    private void broadcastAnswerUpdate() throws SQLException {
        String query = "SELECT COUNT(id) AS nbJoueur FROM joueur WHERE reponse != 'WAIT' AND partie = " + currentPartie;
        PreparedStatement ps = this.connection.prepareStatement(query);
        ResultSet rs = ps.executeQuery();
        rs.next();
        int nbJoueur = rs.getInt("nbJoueur") + 1;
        String query2 = "SELECT num FROM joueur WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?";
        PreparedStatement ps2 = this.connection.prepareStatement(query2);
        ps2.setInt(1, currentPartie);
        ResultSet rs2 = ps2.executeQuery();
        String flag = "NOTAKE";
        int numPlayer = -1;
        if (rs2.next()) {
            flag = "TAKE";
            numPlayer = rs2.getInt("num");
        }
        broadcast(List.of("ANSWER_UPDATE", nbJoueur, flag, numPlayer));
    }

    private void broadcastCallInfo(ArrayList<Integer> ids, ArrayList<String> liens, ArrayList<String> couleurs, String couleur) {
        broadcast(List.of("CALL_INFO", true, ids, liens, couleurs, couleur));
    }

    private void broadcastDogReady() {
        broadcast(List.of("DOG_READY"));
    }

    private void broadcastTourUpdate() throws SQLException {
        if(currentJoueurTour == -1) {
            String query = "SELECT num FROM joueur WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?";
            PreparedStatement ps = this.connection.prepareStatement(query);
            ps.setInt(1, currentPartie);
            ResultSet results = ps.executeQuery();
            if (results.next()) {
                int takerNum = results.getInt("num");
                currentJoueurTour = (takerNum % 5) + 1;
            }
            results.close();
            ps.close();
        }
        ArrayList<String> idCartes= new ArrayList<>();
        ArrayList<String> lienCartes= new ArrayList<>();
        String query2 = "SELECT * FROM plis WHERE id = ? AND pliChien = 0 AND partie = ?";
        PreparedStatement ps2 = this.connection.prepareStatement(query2);
        ps2.setInt(1, currentPlis);
        ps2.setInt(2, currentPartie);
        ResultSet results2 = ps2.executeQuery();
        if (results2.next()) {
            for (int i = 1; i <= 5; i++) {
                if (results2.getString("carte" + i) != null) {
                    String query3 = "SELECT * FROM carte WHERE id = " + results2.getInt("carte" + i);
                    PreparedStatement ps3 = this.connection.prepareStatement(query3);
                    ResultSet results3 = ps3.executeQuery();
                    if (results3.next()) {
                        idCartes.add(results3.getString("id"));
                        lienCartes.add(results3.getString("lien"));
                    }
                }
            }
        }
        ArrayList<Double> scores = new ArrayList<>();
        String qs = "SELECT score FROM joueur WHERE partie = ? ORDER BY num";
        PreparedStatement psScore = this.connection.prepareStatement(qs);
        psScore.setInt(1, currentPartie);
        ResultSet rsScore = psScore.executeQuery();
        while (rsScore.next()) {
            scores.add(rsScore.getDouble("score"));
        }
        broadcast(List.of("TOUR_UPDATE", currentJoueurTour, finTour, finPartie, idCartes, lienCartes, couleurTour, scores));
    }

    private int rank(String couleur, String valeur) {
        if ("EXCUSE".equals(couleur)) return -1;
        if (valeur != null) {
            valeur = valeur.trim();
        }
        try {
            return Integer.parseInt(valeur);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private String normalizeColor(String color) {
        if (color == null) return "";
        color = color.toUpperCase().trim();
        switch (color) {
            case "SPADE":
            case "PIQUE":
                return "PIQUE";
            case "HEART":
            case "COEUR":
                return "COEUR";
            case "CLOVER":
            case "TREFLE":
                return "TREFLE";
            case "DIAMOND":
            case "CARREAU":
                return "CARREAU";
            case "BOUT":
                return "BOUT";
            case "ATOUT":
                return "ATOUT";
            default:
                return color;
        }
    }

    private int determineWinner() throws SQLException {
        String q = "SELECT carte1,carte2,carte3,carte4,carte5 FROM plis WHERE id = ? AND partie = ?";
        PreparedStatement ps = this.connection.prepareStatement(q);
        ps.setInt(1, currentPlis);
        ps.setInt(2, currentPartie);
        ResultSet rs = ps.executeQuery();
        if (!rs.next()) {
            rs.close();
            ps.close();
            return firstPlayer;
        }
        int[] ids = new int[5];
        for (int i = 0; i < 5; i++) {
            ids[i] = rs.getInt("carte" + (i + 1));
        }
        rs.close();
        ps.close();
        int winner = firstPlayer;
        String bestColor = couleurTour;
        int bestRank = -1;
        int player = firstPlayer;
        for (int i = 0; i < 5; i++) {
            int cid = ids[i];
            PreparedStatement pc = this.connection.prepareStatement("SELECT couleur,valeur FROM carte WHERE id = ?");
            pc.setInt(1, cid);
            ResultSet rc = pc.executeQuery();
            if (rc.next()) {
                String c = normalizeColor(rc.getString("couleur"));
                String v = rc.getString("valeur").toUpperCase().trim();
                boolean isExc = c.equals("BOUT") && v.equals("E");
                String eff = isExc ? "EXCUSE" : (c.equals("BOUT") ? "ATOUT" : c);
                int r = rank(eff, v);
                if (i == 0) {
                    bestColor = isExc ? couleurTour : eff;
                    bestRank = r;
                    winner = player;
                } else {
                    if (!isExc) {
                        if (bestColor.equals("ATOUT")) {
                            if (eff.equals("ATOUT") && r > bestRank) {
                                bestRank = r;
                                winner = player;
                            }
                        } else {
                            if (eff.equals("ATOUT")) {
                                bestColor = "ATOUT";
                                bestRank = r;
                                winner = player;
                            } else if (eff.equals(couleurTour) && r > bestRank) {
                                bestRank = r;
                                winner = player;
                            }
                        }
                    }
                }
            }
            rc.close();
            pc.close();
            player = player % 5 + 1;
        }
        return winner;
    }

    private double calculatePoints() throws SQLException {
        lastExcusePlayer = -1;
        lastExcusePoints = 0;
        String q = "SELECT carte1,carte2,carte3,carte4,carte5 FROM plis WHERE id = ? AND partie = ?";
        PreparedStatement ps = this.connection.prepareStatement(q);
        ps.setInt(1, currentPlis);
        ps.setInt(2, currentPartie);
        ResultSet rs = ps.executeQuery();
        double total = 0;
        if (rs.next()) {
            for (int i = 1; i <= 5; i++) {
                int cid = rs.getInt("carte" + i);
                if (rs.wasNull()) continue;
                PreparedStatement pc = this.connection.prepareStatement("SELECT couleur,valeur,points FROM carte WHERE id = ?");
                pc.setInt(1, cid);
                ResultSet rc = pc.executeQuery();
                if (rc.next()) {
                    String c = normalizeColor(rc.getString("couleur"));
                    String v = rc.getString("valeur").toUpperCase().trim();
                    double p = rc.getDouble("points");
                    if (c.equals("BOUT") && v.equals("E")) {
                        lastExcusePlayer = ((firstPlayer + i - 2) % 5) + 1;
                        lastExcusePoints = p;
                    } else {
                        total += p;
                    }
                }
                rc.close();
                pc.close();
            }
        }
        rs.close();
        ps.close();
        return total;
    }

    //Le traitement lancé dans un thread séparé

    public void run() {
        System.err.println("Lancement du traitement de la connexion cliente");

        try {
            in = new ObjectInputStream(sock.getInputStream());
            out = new ObjectOutputStream(sock.getOutputStream());
        } catch (IOException e) {
            e.printStackTrace();
            return;
        }

        //tant que la connexion est active, on traite les demandes
        while (!Thread.currentThread().isInterrupted()) {
            try {
                List<Object> responses = (List<Object>) in.readObject();
                if (responses.get(0).toString().equalsIgnoreCase("SUBSCRIBE")) {
                    listeners.add(out);
                    continue;
                }
                //String response = read();
                InetSocketAddress remote = (InetSocketAddress) sock.getRemoteSocketAddress();

                //On affiche quelques infos, pour le débuggage
                String debug = "";
                debug = "Thread : " + Thread.currentThread().getName() + ". ";
                debug += "Demande de l'adresse : " + remote.getAddress().getHostAddress() + ".";
                debug += " Sur le port : " + remote.getPort() + ".\n";
                debug += "Received [" + responses.size() + "] messages from: " + sock;
                System.err.println("\n" + debug);

                //On traite la demande du client en fonction de la commande envoyée
                List<Object> toSend = new ArrayList<>();
                if(responses.get(0).toString().toUpperCase().equals("CONN")) {
                    //case "CONN":
                    String pseudo = (String) responses.get(1);
                    String password = (String) responses.get(2);
                    String query = "SELECT id, nom, prenom, email,pseudo, motdepasse FROM utilisateur WHERE pseudo=? AND motdepasse=?";
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ps.setString(1, pseudo);
                    ps.setString(2, password);
                    ResultSet results = ps.executeQuery();

                    if (results.next()) {
                        System.out.println("Utilisateur et mot de passe correct");
                        toSend.add("OK");
                        toSend.add(results.getString("nom"));
                        toSend.add(results.getString("prenom"));
                        toSend.add(results.getString("email"));
                        toSend.add(results.getString("id"));

                    } else {
                        System.out.println("Utilisateur et mot de passe incorrects");
                    }
                    //break;
                  /*  case "LIST":
                        //toSend.add(genericList(responses.get(1)));
                        break;*/
                } else if(responses.get(0).toString().toUpperCase().equals("INSC")) {
                    String nom = (String) responses.get(1);
                    String prenom = (String) responses.get(2);
                    String pseudo = (String) responses.get(3);
                    String password = (String) responses.get(4);
                    String email = (String) responses.get(5);
                    String query = "SELECT id, nom, prenom, email,pseudo, motdepasse FROM utilisateur WHERE pseudo=?";
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ps.setString(1, pseudo);
                    ResultSet results = ps.executeQuery();

                    if (results.next()) {
                        toSend.add(true);
                    } else {

                        String insertUser = "INSERT INTO utilisateur (nom,prenom,pseudo,email,motdepasse) VALUES (?,?,?,?,?)";
                        PreparedStatement ps1 = this.connection.prepareStatement(insertUser);
                        ps1.setString(1, nom);
                        ps1.setString(2, prenom);
                        ps1.setString(3, pseudo);
                        ps1.setString(4,email);
                        ps1.setString(5,password);
                        ps1.executeUpdate();
                        toSend.add(false);
                    }

                }else if(responses.get(0).toString().toUpperCase().equals("PLAYLOBBY")) {
                    String idUser = (String) responses.get(1);

                    if(currentnumJoueur%5 ==0) {
                        PreparedStatement stmt2 = this.connection.prepareStatement("INSERT INTO partie() VALUES ()", Statement.RETURN_GENERATED_KEYS);
                        stmt2.executeUpdate();
                        ResultSet gen = stmt2.getGeneratedKeys();
                        if(gen.next()) {
                            currentPartie = gen.getInt(1);
                        }
                        gen.close();
                        stmt2.close();
                        cardsDealt = false;
                    }

                    PreparedStatement ins = this.connection.prepareStatement(
                            "INSERT INTO joueur(utilisateur,num,partie,score) VALUES (?,?,?,0)");
                    ins.setString(1, idUser);
                    ins.setInt(2, (currentnumJoueur % 5) + 1);
                    ins.setInt(3, currentPartie);
                    ins.executeUpdate();

                    toSend.add("JOINLOBBY");
                    toSend.add(currentnumJoueur+1);
                    broadcast(List.of("LOBBY_COUNT", currentnumJoueur + 1));
                    currentnumJoueur++;



                }
                else if(responses.get(0).toString().toUpperCase().equals("WAIT")) {

                    String query = "SELECT COUNT(id) AS\"nbJoueur\"  FROM joueur";
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    results.next();
                    int nbJoueur = results.getInt("nbJoueur");
                    toSend.add(nbJoueur);
                } else if(responses.get(0).toString().toUpperCase().equals("PLAY")) {
                    String idUser = (String) responses.get(1);

                    synchronized (ClientProcessor.class) {
                        if (!cardsDealt) {
                            PreparedStatement psDeck = this.connection.prepareStatement("SELECT id FROM carte ORDER BY RAND()");
                            ResultSet deck = psDeck.executeQuery();
                            ArrayList<Integer> ids = new ArrayList<>();
                            while (deck.next()) {
                                ids.add(deck.getInt("id"));
                            }
                            int index = 0;
                            for (int p = 1; p <= 5; p++) {
                                StringBuilder sb = new StringBuilder("UPDATE joueur SET ");
                                for (int c = 1; c <= 15; c++) {
                                    if (c > 1) sb.append(", ");
                                    sb.append("carte" + c + " = ?");
                                }
                                sb.append(" WHERE num = ? AND partie = ?");
                                PreparedStatement upd = this.connection.prepareStatement(sb.toString());
                                for (int c = 1; c <= 15; c++) {
                                    upd.setInt(c, ids.get(index++));
                                }
                                upd.setInt(16, p);
                                upd.setInt(17, currentPartie);
                                upd.executeUpdate();
                            }
                            PreparedStatement dog = this.connection.prepareStatement("INSERT INTO chien(partie,carte1,carte2,carte3) VALUES(?,?,?,?)");
                            dog.setInt(1, currentPartie);
                            dog.setInt(2, ids.get(index++));
                            dog.setInt(3, ids.get(index++));
                            dog.setInt(4, ids.get(index));
                            dog.executeUpdate();
                            broadcastAnswerUpdate();
                            cardsDealt = true;
                        }
                    }

                    String query2 = "SELECT * FROM joueur WHERE utilisateur = ? AND partie = ?";
                    PreparedStatement ps2 = this.connection.prepareStatement(query2);
                    ps2.setString(1, idUser);
                    ps2.setInt(2, currentPartie);
                    ResultSet results2 = ps2.executeQuery();
                    String numJoueur = "";
                    ArrayList<String> idCartes = new ArrayList<>();
                    ArrayList<String> lienCartes = new ArrayList<>();
                    ArrayList<String> couleurs = new ArrayList<>();
                    if (results2.next()) {
                        numJoueur = results2.getString("num");
                        for (int i = 1; i <= 15; i++) {
                            String cardId = results2.getString("carte" + i);
                            if (cardId == null) continue;
                            PreparedStatement ps3 = this.connection.prepareStatement(
                                    "SELECT id,lien,couleur FROM carte WHERE id = ?");
                            ps3.setInt(1, Integer.parseInt(cardId));
                            ResultSet results3 = ps3.executeQuery();
                            if (results3.next()) {
                                idCartes.add(results3.getString("id"));
                                lienCartes.add(results3.getString("lien"));
                                couleurs.add(normalizeColor(results3.getString("couleur")));
                            }
                        }
                    } else {
                        System.err.println("No player row found for utilisateur=" + idUser + " partie=" + currentPartie);
                    }
                    ArrayList<String> noms = new ArrayList<>();
                    String queryNames = "SELECT num, u.pseudo FROM joueur j JOIN utilisateur u ON j.utilisateur = u.id WHERE partie = ? ORDER BY num";
                    PreparedStatement psNames = this.connection.prepareStatement(queryNames);
                    psNames.setInt(1, currentPartie);
                    ResultSet rsNames = psNames.executeQuery();
                    while (rsNames.next()) {
                        noms.add(rsNames.getString("pseudo"));
                    }
                    toSend.add(idCartes);
                    toSend.add(lienCartes);
                    toSend.add(couleurs);
                    toSend.add(numJoueur);
                    toSend.add(noms);

                } else if(responses.get(0).toString().toUpperCase().equals("WAITANSWER")) {
                    String query = "SELECT COUNT(id) AS\"nbJoueur\"  FROM joueur WHERE reponse != 'WAIT' AND partie = "+ currentPartie;
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    results.next();
                    int nbJoueur = results.getInt("nbJoueur")+1;

                    String query2 = "SELECT num FROM joueur WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?";
                    PreparedStatement ps2 = this.connection.prepareStatement(query2);
                    ps2.setInt(1, currentPartie);
                    ResultSet results2 = ps2.executeQuery();
                    int hasTake = 0;
                    int numPlayer = -1;
                    if(results2.next()) {
                        hasTake = 1;
                        numPlayer = results2.getInt("num");
                    }

                    toSend.add(nbJoueur);
                    if(hasTake >0) {
                        toSend.add("TAKE");
                        toSend.add(numPlayer);
                    } else {
                        toSend.add("NOTAKE");
                        toSend.add(-1);
                    }



                }
                else if(responses.get(0).toString().toUpperCase().equals("CHIEN")) {
                    String contract = (String) responses.get(1);
                    String idUser = (String) responses.get(2);

                    Statement stmt2 = this.connection.createStatement();
                    stmt2.executeUpdate("UPDATE joueur SET reponse = '" + contract + "' , equipe = 1 WHERE utilisateur = " + idUser + " AND partie = " + currentPartie);

                    broadcastAnswerUpdate();


                } else if(responses.get(0).toString().toUpperCase().equals("REFUSE")) {
                    String idUser = (String) responses.get(1);

                    Statement stmt = this.connection.createStatement();
                    stmt.executeUpdate("UPDATE joueur SET reponse = 'REFUSE' , equipe = 2 WHERE utilisateur = " + idUser + " AND partie = " + currentPartie);
                    broadcastAnswerUpdate();
                }  else if(responses.get(0).toString().toUpperCase().equals("ROIS")) {
                    String query = "SELECT *  FROM carte WHERE valeur = '14' AND couleur != 'ATOUT'";
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    ArrayList<String> idCartes = new ArrayList<>();
                    ArrayList<String> lienCartes = new ArrayList<>();
                    while(results.next()) {
                        idCartes.add(results.getString("id"));
                        lienCartes.add(results.getString("lien"));
                    }
                    toSend.add(idCartes);
                    toSend.add(lienCartes);
                } else if(responses.get(0).toString().toUpperCase().equals("CALL")) {
                    int idCarte = (int) responses.get(1);
                    String query2 = "SELECT * FROM joueur WHERE partie = " + currentPartie;
                    for(int i =1; i< 15; i++) {
                        if(i==1) {
                            query2 += " AND carte" + i + " = " + idCarte;
                        }  else {
                            query2+= " OR carte" + i + " = " + idCarte + " ";
                        }
                    }
                    int idUserAllied = -1;
                    PreparedStatement ps2 = this.connection.prepareStatement(query2);
                    ResultSet results2 = ps2.executeQuery();
                    if(results2.next()) {
                        idUserAllied = results2.getInt("utilisateur");
                    }

                    Statement stmt1 = this.connection.createStatement();
                    stmt1.executeUpdate("UPDATE joueur SET equipe = 1 WHERE utilisateur = " + idUserAllied + " AND partie = " + currentPartie) ;

                    Statement stmt2 = this.connection.createStatement();
                    stmt2.executeUpdate("UPDATE joueur SET equipe = 2 WHERE equipe != 1 AND partie = " + currentPartie) ;

                    String query3 = "SELECT * FROM chien WHERE partie = ?";
                    PreparedStatement ps3 = this.connection.prepareStatement(query3);
                    ps3.setInt(1, currentPartie);
                    ResultSet results3 = ps3.executeQuery();
                    ArrayList<Integer> idCartes = new ArrayList<>();
                    ArrayList<String> lienCartes = new ArrayList<>();
                    ArrayList<String> couleurCartes = new ArrayList<>();
                    if(results3.next()) {
                        for(int i = 1; i <= 3; i++) {
                            String query4 = "SELECT * FROM carte WHERE id = " + results3.getInt("carte" + i) ;
                            PreparedStatement ps4 = this.connection.prepareStatement(query4);
                            ResultSet results4 = ps4.executeQuery();
                            if(results4.next()) {
                                idCartes.add(results4.getInt("id"));
                                lienCartes.add(results4.getString("lien"));
                                couleurCartes.add(normalizeColor(results4.getString("couleur")));
                            }
                        }
                    }

                    String query4 = "SELECT * FROM carte WHERE id = " + idCarte;
                    PreparedStatement ps4 = this.connection.prepareStatement(query4);
                    ResultSet results4 = ps4.executeQuery();
                    if(results4.next()) {
                        couleurAppel= normalizeColor(results4.getString("couleur"));
                    }
                    toSend.add(idCartes);
                    toSend.add(lienCartes);
                    toSend.add(couleurCartes);

                    callDone = true;
                    broadcastCallInfo(idCartes, lienCartes, couleurCartes, couleurAppel);


                } else if(responses.get(0).toString().toUpperCase().equals("WAITCALL")) {

                    String query = "SELECT * FROM chien WHERE partie = ?";
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ps.setInt(1, currentPartie);
                    ResultSet results = ps.executeQuery();
                    ArrayList<Integer> idCartes = new ArrayList<>();
                    ArrayList<String> lienCartes = new ArrayList<>();
                    if(results.next()) {
                        for(int i = 1; i <= 3; i++) {
                            String query1 = "SELECT * FROM carte WHERE id = " + results.getInt("carte" + i) ;
                            PreparedStatement ps1 = this.connection.prepareStatement(query1);
                            ResultSet results1 = ps1.executeQuery();
                            if(results1.next()) {
                                idCartes.add(results1.getInt("id"));
                                lienCartes.add(results1.getString("lien"));
                            }
                        }
                    }
//                        ArrayList<String> colorCartes = new ArrayList<>();
//                        colorCartes.add(results1.getString("couleur"));
//                        toSend.add(colorCartes);
                        toSend.add(callDone);
                        toSend.add(idCartes);
                        toSend.add(lienCartes);
                        toSend.add(new ArrayList<String>());
                        toSend.add(couleurAppel);



                }
                else if(responses.get(0).toString().toUpperCase().equals("ADDDOG")) {
                    String idCarte = (String) responses.get(1);

                    String query = "SELECT * FROM carte WHERE id = " + idCarte;
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    if(results.next()) {
                        String couleur = normalizeColor(results.getString("couleur"));
                        String valeur = results.getString("valeur");
                        if(!couleur.equals("BOUT") && !couleur.equals("ATOUT") && !valeur.equals("R")) {
                            if(nbCartesChien == 1) {
                                PreparedStatement stmt = this.connection.prepareStatement("INSERT INTO plis(pliChien,partie) VALUES(?,?)", Statement.RETURN_GENERATED_KEYS);
                                stmt.setInt(1,1);
                                stmt.setInt(2,currentPartie);
                                stmt.executeUpdate();
                                ResultSet gen = stmt.getGeneratedKeys();
                                if(gen.next()) {
                                    currentPlis = gen.getInt(1);
                                }
                                gen.close();
                                stmt.close();
                            }

                            PreparedStatement stmt1 = this.connection.prepareStatement("UPDATE plis SET carte" + nbCartesChien + " = ? WHERE id = ? AND partie = ?");
                            stmt1.setInt(1, Integer.parseInt(idCarte));
                            stmt1.setInt(2, currentPlis);
                            stmt1.setInt(3, currentPartie);
                            stmt1.executeUpdate();

                            // Remove the discarded card from the taker's hand
                            int slot = -1;
                            PreparedStatement find = this.connection.prepareStatement("SELECT * FROM joueur WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?");
                            find.setInt(1, currentPartie);
                            ResultSet rFind = find.executeQuery();
                            if (rFind.next()) {
                                for (int i = 1; i <= 15; i++) {
                                    String cid = rFind.getString("carte" + i);
                                    if (cid != null && cid.equals(idCarte)) {
                                        slot = i;
                                        break;
                                    }
                                }
                            }
                            rFind.close();
                            find.close();
                            if (slot > 0) {
                                PreparedStatement up = this.connection.prepareStatement("UPDATE joueur SET carte" + slot + " = null WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?");
                                up.setInt(1, currentPartie);
                                up.executeUpdate();
                                up.close();
                            }

                            if(nbCartesChien == 3) {
                                dogDone = true;
                                // Set next player after the taker
                                PreparedStatement takerStmt = this.connection.prepareStatement("SELECT num FROM joueur WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?");
                                takerStmt.setInt(1, currentPartie);
                                ResultSet takerRs = takerStmt.executeQuery();
                                if(takerRs.next()) {
                                    int takerNum = takerRs.getInt("num");
                                    currentJoueurTour = (takerNum % 5) + 1;
                                }
                                takerRs.close();
                                takerStmt.close();
                                broadcastDogReady();
                            }
                            toSend.add(dogDone);
                            toSend.add("OK");
                            nbCartesChien++;
                        }
                        else {
                            toSend.add(dogDone);
                            toSend.add("ERROR");
                        }
                    }



                } else if(responses.get(0).toString().toUpperCase().equals("WAITDOG")) {
                    toSend.add(dogDone);
                }
                else if(responses.get(0).toString().toUpperCase().equals("BEGIN")) {
                    if (finTour) {
                        couleurTour = "";
                        finTour = false;
                        countJoueurTour = 1;
                        broadcastTourUpdate();
                        toSend.add("OK");
                    } else {
                        toSend.add("WAIT");
                    }
                }
                else if(responses.get(0).toString().toUpperCase().equals("PLAYTOUR")) {
                    String idCarte = (String) responses.get(1);
                    String idUser = (String) responses.get(2);
                    boolean error = false;
                    finTour = false;
                    String query = "SELECT * FROM carte WHERE id = " + idCarte;
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    String couleurCarte = "";
                    String valeurCarte = "";
                    if(results.next()) {
                        couleurCarte = normalizeColor(results.getString("couleur"));
                        valeurCarte = results.getString("valeur").toUpperCase().trim();
                        if("BOUT".equals(couleurCarte)) {
                            if("E".equals(valeurCarte)) {
                                couleurCarte = "EXCUSE";
                            } else {
                                couleurCarte = "ATOUT";
                            }
                        }
                    }
                    ps.close();
                    int rankCarte = "ATOUT".equals(couleurCarte) ? rank("ATOUT", valeurCarte) : -1;
                    System.out.println("[PLAYTOUR] joueur " + idUser + " tente carte " + idCarte + " (" + couleurCarte + " " + valeurCarte + ") couleurTour=" + couleurTour + " rang=" + rankCarte);
                    if(countJoueurTour == 1) {
                        firstPlayer = currentJoueurTour;
                        PreparedStatement stmt = this.connection.prepareStatement("INSERT INTO plis(pliChien,partie) VALUES(?,?)", Statement.RETURN_GENERATED_KEYS);
                        stmt.setInt(1,0);
                        stmt.setInt(2,currentPartie);
                        stmt.executeUpdate();
                        ResultSet gen = stmt.getGeneratedKeys();
                        if(gen.next()) {
                            currentPlis = gen.getInt(1);
                        }
                        gen.close();
                        stmt.close();
                        if(!"EXCUSE".equals(couleurCarte)) {
                            couleurTour = couleurCarte;
                        } else {
                            couleurTour = "";
                        }
                        PreparedStatement stmt1 = this.connection.prepareStatement("UPDATE plis SET carte" + countJoueurTour + " = ? WHERE id = ? AND partie = ?");
                        stmt1.setInt(1, Integer.parseInt(idCarte));
                        stmt1.setInt(2, currentPlis);
                        stmt1.setInt(3, currentPartie);
                        stmt1.executeUpdate();

                        int slot = -1;
                        PreparedStatement find = this.connection.prepareStatement("SELECT * FROM joueur WHERE utilisateur = ? AND partie = ?");
                        find.setString(1, idUser);
                        find.setInt(2, currentPartie);
                        ResultSet rFind = find.executeQuery();
                        if (rFind.next()) {
                            for (int i = 1; i <= 15; i++) {
                                String cid = rFind.getString("carte" + i);
                                if (cid != null && cid.equals(idCarte)) {
                                    slot = i;
                                    break;
                                }
                            }
                        }
                        rFind.close();
                        find.close();
                        if (slot > 0) {
                            PreparedStatement stmt2 = this.connection.prepareStatement("UPDATE joueur SET carte" + slot + " = null WHERE utilisateur = ? AND partie = ?");
                            stmt2.setString(1, idUser);
                            stmt2.setInt(2, currentPartie);
                            stmt2.executeUpdate();
                        }

                        boolean kingPlayed = couleurAppel != null && couleurAppel.toUpperCase().equals(couleurCarte) && "14".equals(valeurCarte);
                        if (kingPlayed) {
                            broadcast(List.of("KING_PLAYED", currentJoueurTour));
                        }
                    }
                    else {
                        int highestAtoutCenter = 0;
                        String centerQ = "SELECT carte1,carte2,carte3,carte4,carte5 FROM plis WHERE id = ? AND partie = ?";
                        PreparedStatement centerStmt = this.connection.prepareStatement(centerQ);
                        centerStmt.setInt(1, currentPlis);
                        centerStmt.setInt(2, currentPartie);
                        ResultSet centerRs = centerStmt.executeQuery();
                        if(centerRs.next()) {
                            for(int i=1;i<=5;i++) {
                                String cidStr = centerRs.getString("carte"+i);
                                if(cidStr != null) {
                                    PreparedStatement pc2 = this.connection.prepareStatement("SELECT couleur,valeur FROM carte WHERE id = ?");
                                    pc2.setInt(1, Integer.parseInt(cidStr));
                                    ResultSet rc2 = pc2.executeQuery();
                                    if(rc2.next()) {
                                        String c = normalizeColor(rc2.getString("couleur"));
                                        String v = rc2.getString("valeur").toUpperCase().trim();
                                        if(!(c.equals("BOUT") && v.equals("E")) && (c.equals("ATOUT") || c.equals("BOUT"))) {
                                            int r = rank("ATOUT", v);
                                            if(r > highestAtoutCenter) highestAtoutCenter = r;
                                        }
                                    }
                                    rc2.close();
                                    pc2.close();
                                }
                            }
                        }
                        centerRs.close();
                        centerStmt.close();
                        if(couleurTour.isEmpty()) {
                            if(!"EXCUSE".equals(couleurCarte)) {
                                couleurTour = couleurCarte;
                            }
                        } else {
                            String query3 = "SELECT * FROM joueur WHERE utilisateur = " + idUser + " AND partie = " + currentPartie;
                            PreparedStatement ps3 = this.connection.prepareStatement(query3);
                            ResultSet results3 = ps3.executeQuery();
                            boolean hasCouleur = couleurCarte.equals(couleurTour);
                            boolean hasAtout = false;
                            boolean hasHigherAtout = false;
                            if(results3.next()) {
                                int playedId = Integer.parseInt(idCarte);
                                for(int i = 1; i<=15; i++) {
                                    int cid = results3.getInt("carte" + i);
                                    if(!results3.wasNull() && cid != playedId) {
                                        PreparedStatement ps4 = this.connection.prepareStatement("SELECT couleur,valeur FROM carte WHERE id = ?");
                                        ps4.setInt(1, cid);
                                        ResultSet results4 = ps4.executeQuery();
                                        if (results4.next()) {
                                            String c = normalizeColor(results4.getString("couleur"));
                                            String v = results4.getString("valeur").toUpperCase().trim();
                                            boolean isExc = c.equals("BOUT") && v.equals("E");
                                            String eff = isExc ? "EXCUSE" : (c.equals("BOUT") ? "ATOUT" : c);
                                            if(eff.equals(couleurTour)) {
                                                hasCouleur = true;
                                            }
                                            if("ATOUT".equals(eff)) {
                                                hasAtout = true;
                                                int r = rank("ATOUT", v);
                                                if(r > highestAtoutCenter) {
                                                    hasHigherAtout = true;
                                                }
                                            }
                                        }
                                        results4.close();
                                        ps4.close();
                                    }
                                }
                            }
                            results3.close();
                            ps3.close();
                            System.out.println("[PLAYTOUR] main joueur " + idUser + " hasCouleur=" + hasCouleur + ", hasAtout=" + hasAtout + ", hasHigherAtout=" + hasHigherAtout + ", highestAtoutCenter=" + highestAtoutCenter);
                            if(plisCount == 14 && "EXCUSE".equals(couleurCarte)) {
                                System.out.println("[PLAYTOUR] refus : excuse au dernier pli");
                                error = true;
                            } else if("EXCUSE".equals(couleurCarte)) {
                                // always allowed
                            } else if(hasCouleur) {
                                if(!couleurCarte.equals(couleurTour)) {
                                    System.out.println("[PLAYTOUR] refus : doit fournir la couleur " + couleurTour);
                                    error = true;
                                } else if("ATOUT".equals(couleurTour) && highestAtoutCenter > 0 && hasHigherAtout && rankCarte < highestAtoutCenter) {
                                    System.out.println("[PLAYTOUR] refus : doit monter sur atout " + highestAtoutCenter);
                                    error = true;
                                }
                            } else if(hasAtout) {
                                if(!"ATOUT".equals(couleurCarte)) {
                                    System.out.println("[PLAYTOUR] refus : doit couper");
                                    error = true;
                                } else if("ATOUT".equals(couleurTour) && highestAtoutCenter > 0 && hasHigherAtout && rankCarte < highestAtoutCenter) {
                                    System.out.println("[PLAYTOUR] refus : doit couper plus haut que " + highestAtoutCenter);
                                    error = true;
                                }
                            }
                        }
                        if(!error) {
                            PreparedStatement stmt1 = this.connection.prepareStatement("UPDATE plis SET carte" + countJoueurTour + " = ? WHERE id = ? AND partie = ?");
                            stmt1.setInt(1, Integer.parseInt(idCarte));
                            stmt1.setInt(2, currentPlis);
                            stmt1.setInt(3, currentPartie);
                            stmt1.executeUpdate();

                            int slot = -1;
                            PreparedStatement find = this.connection.prepareStatement("SELECT * FROM joueur WHERE utilisateur = ? AND partie = ?");
                            find.setString(1, idUser);
                            find.setInt(2, currentPartie);
                            ResultSet rFind = find.executeQuery();
                            if (rFind.next()) {
                                for (int i = 1; i <= 15; i++) {
                                    String cid = rFind.getString("carte" + i);
                                    if (cid != null && cid.equals(idCarte)) {
                                        slot = i;
                                        break;
                                    }
                                }
                            }
                            rFind.close();
                            find.close();
                            if (slot > 0) {
                                PreparedStatement stmt2 = this.connection.prepareStatement("UPDATE joueur SET carte" + slot + " = null WHERE utilisateur = ? AND partie = ?");
                                stmt2.setString(1, idUser);
                                stmt2.setInt(2, currentPartie);
                                stmt2.executeUpdate();
                            }

                            boolean kingPlayed = couleurAppel != null && couleurAppel.toUpperCase().equals(couleurCarte) && "14".equals(valeurCarte);
                            if (kingPlayed) {
                                broadcast(List.of("KING_PLAYED", currentJoueurTour));
                            }
                        }
                    }
                    if(error == false) {
                        String checkQ = "SELECT carte1,carte2,carte3,carte4,carte5 FROM plis WHERE id = ? AND partie = ?";
                        PreparedStatement checkStmt = this.connection.prepareStatement(checkQ);
                        checkStmt.setInt(1, currentPlis);
                        checkStmt.setInt(2, currentPartie);
                        ResultSet checkRs = checkStmt.executeQuery();
                        int filled = 0;
                        if (checkRs.next()) {
                            for (int i = 1; i <= 5; i++) {
                                if (checkRs.getString("carte" + i) != null) {
                                    filled++;
                                }
                            }
                        }
                        checkRs.close();
                        checkStmt.close();
                        if (filled == 5) {
                            finTour = true;
                            countJoueurTour = 1;
                            plisCount++;
                            int gagnant = determineWinner();
                            currentJoueurTour = gagnant;
                            double pts = calculatePoints();
                            PreparedStatement upScore = this.connection.prepareStatement("UPDATE joueur SET score = score + ? WHERE num = ? AND partie = ?");
                            upScore.setDouble(1, pts);
                            upScore.setInt(2, gagnant);
                            upScore.setInt(3, currentPartie);
                            upScore.executeUpdate();
                            if(lastExcusePlayer != -1) {
                                PreparedStatement upExcuse = this.connection.prepareStatement("UPDATE joueur SET score = score + ? WHERE num = ? AND partie = ?");
                                upExcuse.setDouble(1, lastExcusePoints);
                                upExcuse.setInt(2, lastExcusePlayer);
                                upExcuse.setInt(3, currentPartie);
                                upExcuse.executeUpdate();
                            }
                            PreparedStatement upPli = this.connection.prepareStatement("UPDATE plis SET joueurGagnant = ? WHERE id = ? AND partie = ?");
                            upPli.setInt(1, gagnant);
                            upPli.setInt(2, currentPlis);
                            upPli.setInt(3, currentPartie);
                            upPli.executeUpdate();
                            if(plisCount == 15) {
                                finPartie = true;
                            }
                        } else {
                            countJoueurTour = filled + 1;
                            currentJoueurTour = currentJoueurTour == 5 ? 1 : currentJoueurTour + 1;
                        }
                    }
                    System.out.println("[PLAYTOUR] resultat pour joueur " + idUser + " carte " + idCarte + " -> " + (error ? "REFUS" : "ACCEPTE"));
                    toSend.add(error);
                    broadcastTourUpdate();

                }
                else if(responses.get(0).toString().toUpperCase().equals("WAITTOUR")) {
                    if(currentJoueurTour == -1) {
                        String query = "SELECT num FROM joueur WHERE reponse NOT IN ('WAIT','REFUSE') AND partie = ?";
                        PreparedStatement ps = this.connection.prepareStatement(query);
                        ps.setInt(1, currentPartie);
                        ResultSet results = ps.executeQuery();
                        if (results.next()) {
                            int takerNum = results.getInt("num");
                            currentJoueurTour = (takerNum % 5) + 1;
                        }
                        results.close();
                        ps.close();

                    }
                    ArrayList<String> idCartes= new ArrayList<>();
                    ArrayList<String> lienCartes= new ArrayList<>();
                    String query2 = "SELECT * FROM plis WHERE id = ? AND pliChien = 0 AND partie = ?";
                    PreparedStatement ps2 = this.connection.prepareStatement(query2);
                    ps2.setInt(1, currentPlis);
                    ps2.setInt(2, currentPartie);
                    ResultSet results2 = ps2.executeQuery();
                    if (results2.next()) {
                            for (int i = 1; i <= 5; i++) {
                                if (results2.getString("carte" + i) != null) {
                                    String query3 = "SELECT * FROM carte WHERE id = " + results2.getInt("carte" + i);
                                    PreparedStatement ps3 = this.connection.prepareStatement(query3);
                                    ResultSet results3 = ps3.executeQuery();
                                    if (results3.next()) {
                                        idCartes.add(results3.getString("id"));
                                        lienCartes.add(results3.getString("lien"));
                                    }
                                }

                            }
                    }
                    ArrayList<Double> scores = new ArrayList<>();
                    String qs = "SELECT score FROM joueur WHERE partie = ? ORDER BY num";
                    PreparedStatement psScore = this.connection.prepareStatement(qs);
                    psScore.setInt(1, currentPartie);
                    ResultSet rsScore = psScore.executeQuery();
                    while (rsScore.next()) {
                        scores.add(rsScore.getDouble("score"));
                    }
                    toSend.add(currentJoueurTour);
                    toSend.add(finTour);
                    toSend.add(finPartie);
                    toSend.add(idCartes);
                    toSend.add(lienCartes);
                    toSend.add(couleurTour);
                    toSend.add(scores);
                }
                else if(responses.get(0).toString().toUpperCase().equals("FINTOUR")) {
                }else {
                        toSend.add("UNKNOWN_COMMAND");
                        break;
                }

                out.writeObject(toSend);
                out.flush();

            } catch (SocketException e) {
                System.err.println("Interruption de la connexion");
                break;
            } catch (IOException e) {
                e.printStackTrace();
                break;
            } catch (ClassNotFoundException e) {
                e.printStackTrace();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
        listeners.remove(out);
    }

    // plus utilisé
}
