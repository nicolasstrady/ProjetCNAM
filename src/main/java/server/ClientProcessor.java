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
    public static int currentJoueurTour = -1;
    public static int countJoueurTour = 1;
    public static int countNbTour = 1;
     public static  String couleurAppel = null;
    public static boolean finPartie = false;
    public static boolean finTour = false;
    public static String couleurTour = "";

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
        String query2 = "SELECT num FROM joueur WHERE reponse = 'TAKE' AND partie = ?";
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

    private void broadcastCallInfo(ArrayList<Integer> ids, ArrayList<String> liens, String couleur) {
        broadcast(List.of("CALL_INFO", true, ids, liens, couleur));
    }

    private void broadcastDogReady() {
        broadcast(List.of("DOG_READY"));
    }

    private void broadcastTourUpdate() throws SQLException {
        if(currentJoueurTour == -1) {
            String query = "SELECT * FROM joueur WHERE reponse = 'TAKE' AND partie = " + currentPartie;
            PreparedStatement ps = this.connection.prepareStatement(query);
            ResultSet results = ps.executeQuery();
            if (results.next()) {
                currentJoueurTour = results.getInt("num") + 1;
            }
        }
        ArrayList<String> idCartes= new ArrayList<>();
        ArrayList<String> lienCartes= new ArrayList<>();
        String query2 = "SELECT * FROM plis WHERE id = " + currentPlis + " AND pliChien = 0";
        PreparedStatement ps2 = this.connection.prepareStatement(query2);
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
        broadcast(List.of("TOUR_UPDATE", currentJoueurTour, finTour, finPartie, idCartes, lienCartes));
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
                        String query = "SELECT COUNT(id) AS\"nbPartie\"  FROM partie ";
                        PreparedStatement ps = this.connection.prepareStatement(query);
                        ResultSet results = ps.executeQuery();
                        if(results.next()) {
                            currentPartie = results.getInt("nbPartie") +1;
                        }

                        Statement stmt2 = this.connection.createStatement();
                        stmt2.executeUpdate("INSERT INTO partie(id) VALUES ("+ currentPartie  +")") ;
                    }

                    Statement stmt = this.connection.createStatement();
                    stmt.executeUpdate("INSERT INTO joueur(utilisateur,num,partie) VALUES (" + idUser + ","+ ((currentnumJoueur%5)+1) + ","+ currentPartie +")");

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

                    String check = "SELECT carte1 FROM joueur WHERE partie = ? LIMIT 1";
                    PreparedStatement ck = this.connection.prepareStatement(check);
                    ck.setInt(1, currentPartie);
                    ResultSet ckRes = ck.executeQuery();
                    boolean needDeal = true;
                    if(ckRes.next() && ckRes.getObject(1) != null) {
                        needDeal = false;
                    }

                    if (needDeal) {
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
                        PreparedStatement dog = this.connection.prepareStatement("INSERT INTO chien(carte1,carte2,carte3) VALUES(?,?,?)");
                        dog.setInt(1, ids.get(index++));
                        dog.setInt(2, ids.get(index++));
                        dog.setInt(3, ids.get(index));
                        dog.executeUpdate();
                        broadcastAnswerUpdate();
                    }

                    String query2 = "SELECT *  FROM joueur WHERE utilisateur = " + idUser + " AND partie = "+ currentPartie;
                    PreparedStatement ps2 = this.connection.prepareStatement(query2);
                    ResultSet results2 = ps2.executeQuery();
                    String numJoueur = "";
                    ArrayList<String> idCartes = new ArrayList<>();
                    ArrayList<String> lienCartes = new ArrayList<>();
                    if(results2.next()) {
                        numJoueur = results2.getString("num");
                        for(int i =1; i<=15;i++) {
                            String query3 = "SELECT *  FROM carte WHERE id = " + results2.getString("carte" + i);
                            PreparedStatement ps3 = this.connection.prepareStatement(query3);

                            ResultSet results3 = ps3.executeQuery();
                            if (results3.next()) {
                                idCartes.add(results3.getString("id"));
                                lienCartes.add(results3.getString("lien"));
                            }
                        }
                    }
                    toSend.add(lienCartes);
                    toSend.add(idCartes);
                    toSend.add(numJoueur);

                } else if(responses.get(0).toString().toUpperCase().equals("WAITANSWER")) {
                    String query = "SELECT COUNT(id) AS\"nbJoueur\"  FROM joueur WHERE reponse != 'WAIT' AND partie = "+ currentPartie;
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    results.next();
                    int nbJoueur = results.getInt("nbJoueur")+1;

                    String query2 = "SELECT num FROM joueur WHERE reponse = 'TAKE' AND partie = ?";
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
                    String idUser = (String) responses.get(1);

                    Statement stmt2 = this.connection.createStatement();
                    stmt2.executeUpdate("UPDATE joueur SET reponse = 'TAKE' , equipe = 1 WHERE utilisateur = " + idUser + " AND partie = " + currentPartie) ;

                    broadcastAnswerUpdate();



                } else if(responses.get(0).toString().toUpperCase().equals("REFUSE")) {
                    String idUser = (String) responses.get(1);

                    Statement stmt = this.connection.createStatement();
                    stmt.executeUpdate("UPDATE joueur SET reponse = 'REFUSE' , equipe = 2 WHERE utilisateur = " + idUser + " AND partie = " + currentPartie);
                    broadcastAnswerUpdate();
                }  else if(responses.get(0).toString().toUpperCase().equals("ROIS")) {
                    String query = "SELECT *  FROM carte WHERE valeur = 'R'";
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

                    String query3 = "SELECT * FROM chien";
                    PreparedStatement ps3 = this.connection.prepareStatement(query3);
                    ResultSet results3 = ps3.executeQuery();
                    ArrayList<Integer> idCartes = new ArrayList<>();
                    ArrayList<String> lienCartes = new ArrayList<>();
                    if(results3.next()) {
                        for(int i = 1; i <= 3; i++) {
                            String query4 = "SELECT * FROM carte WHERE id = " + results3.getInt("carte" + i) ;
                            PreparedStatement ps4 = this.connection.prepareStatement(query4);
                            ResultSet results4 = ps4.executeQuery();
                            if(results4.next()) {
                                idCartes.add(results4.getInt("id"));
                                lienCartes.add(results4.getString("lien"));
                            }
                        }
                    }

                    String query4 = "SELECT * FROM carte WHERE id = " + idCarte;
                    PreparedStatement ps4 = this.connection.prepareStatement(query4);
                    ResultSet results4 = ps4.executeQuery();
                    if(results4.next()) {
                        couleurAppel= results4.getString("couleur");
                    }
                    toSend.add(idCartes);
                    toSend.add(lienCartes);

                    callDone = true;
                    broadcastCallInfo(idCartes, lienCartes, couleurAppel);


                } else if(responses.get(0).toString().toUpperCase().equals("WAITCALL")) {

                    String query = "SELECT * FROM chien";
                    PreparedStatement ps = this.connection.prepareStatement(query);
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
                        toSend.add(couleurAppel);



                }
                else if(responses.get(0).toString().toUpperCase().equals("ADDDOG")) {
                    String idCarte = (String) responses.get(1);

                    String query = "SELECT * FROM carte WHERE id = " + idCarte;
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    if(results.next()) {
                        String couleur = results.getString("couleur");
                        String valeur = results.getString("valeur");
                        if(!couleur.equals("BOUT") && !couleur.equals("ATOUT") && !valeur.equals("R")) {
                            if(nbCartesChien == 1) {

                                String query2 = "SELECT COUNT(id) AS\"nbPlis\"  FROM plis ";
                                PreparedStatement ps2 = this.connection.prepareStatement(query2);
                                ResultSet results2 = ps2.executeQuery();
                                if(results2.next()) {
                                    currentPlis = results2.getInt("nbPlis") +1;
                                }
                                Statement stmt = this.connection.createStatement();
                                stmt.executeUpdate("INSERT INTO plis(id,pliChien) VALUES("+ currentPlis +",1)");


                            }
                            Statement stmt1 = this.connection.createStatement();
                            stmt1.executeUpdate("UPDATE plis SET carte" + nbCartesChien + " = " + idCarte + " WHERE id = " + currentPlis);
                            if(nbCartesChien == 3) {
                                dogDone = true;
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
//                    finTour = false;
                    broadcastTourUpdate();
                }
                else if(responses.get(0).toString().toUpperCase().equals("PLAYTOUR")) {
                    String idCarte = (String) responses.get(1);
                    String idUser = (String) responses.get(2);
                    int numeroCarte= (int) responses.get(3);
                    boolean error = false;
                    finTour = false;
 //                    idCartesTour.add(Integer.parseInt(idCarte));
//                    if(currentJoueurTour)
                    String query = "SELECT * FROM carte WHERE id = " + idCarte;
                    PreparedStatement ps = this.connection.prepareStatement(query);
                    ResultSet results = ps.executeQuery();
                    String couleurCarte = "";
                    if(results.next()) {
                        couleurCarte = results.getString("couleur");
                    }


                    if(countJoueurTour == 1) {
                        String query2 = "SELECT COUNT(id) AS\"nbPlis\"  FROM plis ";
                        PreparedStatement ps2 = this.connection.prepareStatement(query2);
                        ResultSet results2 = ps2.executeQuery();
                        if(results2.next()) {
                            currentPlis = results2.getInt("nbPlis") +1;
                        }
                        Statement stmt = this.connection.createStatement();
                        stmt.executeUpdate("INSERT INTO plis(id,pliChien) VALUES("+ currentPlis +",0)");
                        couleurTour = couleurCarte;
                        Statement stmt1 = this.connection.createStatement();
                        stmt1.executeUpdate("UPDATE plis SET carte" + countJoueurTour + " = " + idCarte + " WHERE id = " + currentPlis);
                        Statement stmt2 = this.connection.createStatement();
                        stmt2.executeUpdate("UPDATE joueur SET carte" + numeroCarte + " = null WHERE utilisateur = " + idUser + " AND partie = " + currentPartie);
                    }
                    else {
                        String query3 = "SELECT * FROM joueur WHERE utilisateur = " + idUser + " AND partie = " + currentPartie;
                        PreparedStatement ps3 = this.connection.prepareStatement(query3);
                        ResultSet results3 = ps3.executeQuery();
                        boolean hasCouleur = false;
                        if(results3.next()) {
                            for(int i = 1; i<=15; i++) {
                                if(results3.getString("carte" +i) != null) {
                                    String query4 = "SELECT * FROM carte WHERE id = " + results3.getInt("carte" + i) + " AND couleur = \"" + couleurTour  + "\"";
                                    PreparedStatement ps4 = this.connection.prepareStatement(query4);
                                    ResultSet results4 = ps4.executeQuery();
                                    if (results4.next()) {
                                        hasCouleur = true;
                                    }
                                }
                            }
                        }
                        if((couleurCarte.equals(couleurTour) && hasCouleur == true) || (hasCouleur == false && couleurCarte.equals("ATOUT"))) {
                            Statement stmt1 = this.connection.createStatement();
                            stmt1.executeUpdate("UPDATE plis SET carte" + countJoueurTour + " = " + idCarte + " WHERE id = " + currentPlis);
                            Statement stmt2 = this.connection.createStatement();
                            stmt2.executeUpdate("UPDATE joueur SET carte" + numeroCarte + " = null WHERE utilisateur = " + idUser + " AND partie = " + currentPartie);
                        } else {
                            error = true;
                        }
                    }
                    if(error == false) {
                        if (countJoueurTour == 5) {
                            finTour = true;
                            countJoueurTour = 1;
                        } else {
                            countJoueurTour++;
                        }

                        if (currentPlis % 16 == 0) {
                            finPartie = true;
                        }

                        if (currentJoueurTour == 5) {
                            currentJoueurTour = 1;
                        } else {
                            currentJoueurTour++;
                        }
                    }
                    toSend.add(error);
                    broadcastTourUpdate();

                }
                else if(responses.get(0).toString().toUpperCase().equals("WAITTOUR")) {
                    if(currentJoueurTour == -1) {
                        String query = "SELECT * FROM joueur WHERE reponse = 'TAKE' AND partie = " + currentPartie;
                        PreparedStatement ps = this.connection.prepareStatement(query);
                        ResultSet results = ps.executeQuery();
                        if (results.next()) {
                            currentJoueurTour = results.getInt("num") + 1;
                        }

                    }
                    ArrayList<String> idCartes= new ArrayList<>();
                    ArrayList<String> lienCartes= new ArrayList<>();
                    String query2 = "SELECT * FROM plis WHERE id = " + currentPlis + " AND pliChien = 0";
                    PreparedStatement ps2 = this.connection.prepareStatement(query2);
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
                    toSend.add(currentJoueurTour);
                    toSend.add(finTour);
                    toSend.add(finPartie);
                    toSend.add(idCartes);
                    toSend.add(lienCartes);
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
