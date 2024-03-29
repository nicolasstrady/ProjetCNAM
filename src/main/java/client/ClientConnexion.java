package client;

import javafx.beans.Observable;

import java.io.*;
import java.net.InetAddress;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.Observer;
import java.util.Random;

public class ClientConnexion {

    private Socket connexion;
    private PrintWriter writer;
    private BufferedInputStream reader;
    private ArrayList<Object> datas;
    private static int count = 0;
    private String name = "Client-";
    private ArrayList<Object> response;

    /**
     *
     * @param host
     * @param port
     */
    public ClientConnexion(String host, int port, ArrayList<Object> datas) {
        try {
            this.
            name += ++count;
            this.connexion = new Socket(host,port);
            this.datas = datas;
        } catch(UnknownHostException e) {
            System.out.println("Erreur - Hôte inconnu");
            e.printStackTrace();
        } catch(IOException e) {
            e.printStackTrace();
        }
    }

    public ArrayList<Object> getResponse() {
        return response;
    }

    /**
     * Simulation d'envoie de commande de client au serveur.
     */
    public ArrayList<Object> run() {
        //for(int i =0; i < 10; i++){
        try {
            Thread.currentThread().sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        try {
/*                writer = new PrintWriter(this.connexion.getOutputStream(), true);
                reader = new BufferedInputStream(this.connexion.getInputStream());
                //On envoie la commande au serveur
                String commande = this.getCommand();
                writer.write(commande);
                writer.flush();
                System.out.println("Commande " + commande + " envoyée au serveur");

                //On attend la réponse
                String reponse = read();
                //System.out.println("\t * " + this.pseudo + " Réponse reçue " + reponse);*/
            OutputStream outputStream = connexion.getOutputStream();
            //On envoie la commande au serveur
            ObjectOutputStream objectOutputStream = new ObjectOutputStream(outputStream);

            // Liste des messages a envoyer
            objectOutputStream.writeObject(this.datas);
            objectOutputStream.flush();

            //On attend la réponse
            InputStream inputStream = connexion.getInputStream();
            ObjectInputStream objectInputStream = new ObjectInputStream(inputStream);
            this.response = (ArrayList<Object>) objectInputStream.readObject();
            System.out.println("Réponse du serveur " + response);
            objectInputStream.close();
            System.out.println("\t * " + name + " : Réponse reçue " + response);
            this.connexion.close();
            return this.response;

        } catch (IOException | ClassNotFoundException e1) {
            e1.printStackTrace();
            return null;
        }
     //   }
    }

    /**
     * Accesseur sur les commandes.
     * @return String
     */
/*    private String getCommand() {
        Random rand = new Random();
        return listCommands[rand.nextInt(listCommands.length)];
    }*/

/*    *//**
     * Methode de lecture des réponses du serveur.
     * @return
     * @throws IOException
     *//*
    private String read() throws IOException{
        String response = "";
        int stream;
        byte[] b = new byte[4096];
        stream = reader.read(b);
        response = new String(b, 0, stream);
        return response;
    }*/
/*
    public static void main(String[]args) throws UnknownHostException {
         ClientConnexion cltConnexion = new ClientConnexion("192.168.1.77",3333,"Hippo");
         InetAddress adrLocale = InetAddress.getLocalHost();
         System.out.println(adrLocale);
    }*/
}
